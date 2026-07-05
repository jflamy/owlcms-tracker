import { competitionHub } from '$lib/server/competition-hub.js';
import { registerCache } from '$lib/server/cache-utils.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';
import {
	calculateTeamPoints,
	calculateSinclair as CalculateSinclair,
	calculateSinclairMasters as CalculateSinclairMasters,
	calculateQPoints as CalculateQPoints,
	calculateGamx as computeGamx,
	normalizeMastersAgeFactorYear,
	normalizeSinclairYear,
	Variant
} from '@owlcms/tracker-core/scoring';

const rankingsCache = new Map();
registerCache(rankingsCache);

const SECTION_CONFIG = {
	M: { type: 'M', variant: 'men', label: 'Men' },
	F: { type: 'F', variant: 'women', label: 'Women' },
	MF: { type: 'MF', variant: 'mixed', label: 'Mixed' }
};

const DEFAULT_PAGE_SIZE = 10;
const TEMPORARY_MIN_TEAMS_PER_SECTION = 0;
const DEFAULT_SINCLAIR_YEAR = 2024;
const DEFAULT_SMHF_SINCLAIR_YEAR = 2020;
const DEFAULT_SMHF_AGE_FACTOR_YEAR = 2020;

function positiveCap(value) {
	return Number.isFinite(value) && value > 0 ? value : null;
}

function parseNumber(value) {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : 0;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function normalizeGender(gender) {
	const normalized = String(gender || '').trim().toUpperCase();
	return normalized === 'W' ? 'F' : normalized;
}

function normalizeScoreSystem(scoreSystem) {
	return String(scoreSystem || '')
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '_');
}

function parseChampionshipFilter(value) {
	if (!value) {
		return null;
	}

	if (Array.isArray(value)) {
		const normalized = value.map((item) => String(item || '').trim()).filter(Boolean);
		return normalized.length > 0 ? new Set(normalized) : null;
	}

	const normalized = String(value)
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);

	return normalized.length > 0 ? new Set(normalized) : null;
}

function getCompetitionSinclairYear(databaseState) {
	return normalizeSinclairYear(databaseState?.competition?.sinclairYear, DEFAULT_SINCLAIR_YEAR);
}

function resolveSinclairYearOption(optionValue, competitionYear) {
	const normalizedOption = String(optionValue ?? '').trim();
	if (!normalizedOption || normalizedOption.toLowerCase() === 'competition') {
		return competitionYear;
	}

	const parsedYear = Number.parseInt(normalizedOption, 10);
	return normalizeSinclairYear(parsedYear, competitionYear);
}

function getCompetitionDate(databaseState) {
	const value = databaseState?.competition?.competitionDate;
	if (!Array.isArray(value) || value.length < 3) {
		return null;
	}

	const [year, month, day] = value;
	return new Date(Date.UTC(year, month - 1, day));
}

function calculateAge(athlete, competitionDate) {
	if (!competitionDate || !Array.isArray(athlete?.fullBirthDate) || athlete.fullBirthDate.length < 3) {
		return 0;
	}

	const [year, month, day] = athlete.fullBirthDate;
	const birthDate = new Date(Date.UTC(year, month - 1, day));
	let age = competitionDate.getUTCFullYear() - birthDate.getUTCFullYear();
	const beforeBirthday =
		competitionDate.getUTCMonth() < birthDate.getUTCMonth() ||
		(competitionDate.getUTCMonth() === birthDate.getUTCMonth() && competitionDate.getUTCDate() < birthDate.getUTCDate());

	if (beforeBirthday) {
		age -= 1;
	}

	return Math.max(age, 0);
}

function buildCategoryCodeMap(databaseState) {
	const categoryCodeToChampionshipName = new Map();
	const activeChampionshipNames = [];
	const activeChampionshipSet = new Set();

	for (const ageGroup of databaseState?.ageGroups || []) {
		if (!ageGroup?.active || !ageGroup?.championshipName) {
			continue;
		}

		if (!activeChampionshipSet.has(ageGroup.championshipName)) {
			activeChampionshipSet.add(ageGroup.championshipName);
			activeChampionshipNames.push(ageGroup.championshipName);
		}

		for (const category of ageGroup.categories || []) {
			if (category?.code) {
				categoryCodeToChampionshipName.set(category.code, ageGroup.championshipName);
			}
		}
	}

	return { categoryCodeToChampionshipName, activeChampionshipNames };
}

function buildDoneSessionSet(databaseState) {
	const doneSessions = new Set();

	for (const session of databaseState?.sessions || []) {
		if (session?.name && session?.done) {
			doneSessions.add(String(session.name));
		}
	}

	return doneSessions;
}

function getParticipationForChampionship(athlete, championshipName, categoryCodeToChampionshipName) {
	for (const participation of athlete?.participations || []) {
		if (categoryCodeToChampionshipName.get(participation?.categoryCode) === championshipName) {
			return participation;
		}
	}

	return null;
}

function resolveTeamName(athlete) {
	const explicitTeamName = String(athlete?.teamName || '').trim();
	if (explicitTeamName) {
		return explicitTeamName;
	}

	const teamId = athlete?.team;
	if (teamId != null && typeof competitionHub.getTeamNameById === 'function') {
		const resolved = String(competitionHub.getTeamNameById({ teamId }) || '').trim();
		if (resolved) {
			return resolved;
		}
	}

	return '';
}

function getScoreMode(sectionType, championship) {
	const scoreSystem = sectionType === 'MF'
		? championship?.mixedTeamScoringSystem
		: championship?.teamScoringSystem;

	return scoreSystem ? 'score' : 'points';
}

function getSectionDenominator(sectionType, championship, rosterSize) {
	if (sectionType === 'M') {
		return Math.min(positiveCap(championship?.mensBestN) ?? rosterSize, rosterSize);
	}

	if (sectionType === 'F') {
		return Math.min(positiveCap(championship?.womensBestN) ?? rosterSize, rosterSize);
	}

	const mixedBestN = positiveCap(championship?.mixedBestN);
	if (mixedBestN != null) {
		return Math.min(mixedBestN, rosterSize);
	}

	const menCap = positiveCap(championship?.mixedMensBestN);
	const womenCap = positiveCap(championship?.mixedWomensBestN);
	if (menCap != null || womenCap != null) {
		return Math.min((menCap ?? 0) + (womenCap ?? 0), rosterSize);
	}

	return rosterSize;
}

function getPrimaryRank(participation, rankKey) {
	if (!participation) {
		return Number.POSITIVE_INFINITY;
	}

	switch (rankKey) {
		case 'SNATCH':
			return participation.snatchRank > 0 ? participation.snatchRank : Number.POSITIVE_INFINITY;
		case 'CJ':
		case 'CLEAN_JERK':
			return participation.cleanJerkRank > 0 ? participation.cleanJerkRank : Number.POSITIVE_INFINITY;
		case 'COMBINED':
			return participation.combinedRank > 0 ? participation.combinedRank : Number.POSITIVE_INFINITY;
		case 'TOTAL':
		default:
			return participation.totalRank > 0 ? participation.totalRank : Number.POSITIVE_INFINITY;
	}
}

function comparePointCandidates(left, right) {
	if (left.primaryRank !== right.primaryRank) {
		return left.primaryRank - right.primaryRank;
	}

	if (right.total !== left.total) {
		return right.total - left.total;
	}

	if (right.bestSnatch !== left.bestSnatch) {
		return right.bestSnatch - left.bestSnatch;
	}

	if (right.bestCleanJerk !== left.bestCleanJerk) {
		return right.bestCleanJerk - left.bestCleanJerk;
	}

	if (left.bodyWeight !== right.bodyWeight) {
		return left.bodyWeight - right.bodyWeight;
	}

	return left.sortName.localeCompare(right.sortName, undefined, { sensitivity: 'base' });
}

function compareScoreCandidates(left, right) {
	if (right.scoreMetric !== left.scoreMetric) {
		return right.scoreMetric - left.scoreMetric;
	}

	if (right.total !== left.total) {
		return right.total - left.total;
	}

	if (right.bestSnatch !== left.bestSnatch) {
		return right.bestSnatch - left.bestSnatch;
	}

	if (right.bestCleanJerk !== left.bestCleanJerk) {
		return right.bestCleanJerk - left.bestCleanJerk;
	}

	if (left.bodyWeight !== right.bodyWeight) {
		return left.bodyWeight - right.bodyWeight;
	}

	return left.sortName.localeCompare(right.sortName, undefined, { sensitivity: 'base' });
}

function selectCandidates(candidates, sectionType, championship) {
	if (sectionType !== 'MF') {
		const cap = sectionType === 'M'
			? positiveCap(championship?.mensBestN)
			: positiveCap(championship?.womensBestN);
		return cap == null ? [...candidates] : candidates.slice(0, cap);
	}

	const mixedBestN = positiveCap(championship?.mixedBestN);
	if (mixedBestN != null) {
		return candidates.slice(0, mixedBestN);
	}

	const menCap = positiveCap(championship?.mixedMensBestN);
	const womenCap = positiveCap(championship?.mixedWomensBestN);
	const selected = [];
	let menCount = 0;
	let womenCount = 0;

	for (const candidate of candidates) {
		if (candidate.gender === 'M') {
			if (menCap != null && menCount >= menCap) {
				continue;
			}
			menCount += 1;
			selected.push(candidate);
			continue;
		}

		if (candidate.gender === 'F') {
			if (womenCap != null && womenCount >= womenCap) {
				continue;
			}
			womenCount += 1;
			selected.push(candidate);
		}
	}

	return selected;
}

function buildPointValues(candidate, championship) {
	const teamPoints1st = parseNumber(championship?.teamPoints1st) || 28;
	const teamPoints2nd = parseNumber(championship?.teamPoints2nd) || 25;
	const teamPoints3rd = parseNumber(championship?.teamPoints3rd) || 23;
	const teamMember = true;

	const snatchPoints = calculateTeamPoints(candidate.participation?.snatchRank, candidate.bestSnatch, teamMember, teamPoints1st, teamPoints2nd, teamPoints3rd);
	const cjPoints = calculateTeamPoints(candidate.participation?.cleanJerkRank, candidate.bestCleanJerk, teamMember, teamPoints1st, teamPoints2nd, teamPoints3rd);
	const totalPoints = calculateTeamPoints(candidate.participation?.totalRank, candidate.total, teamMember, teamPoints1st, teamPoints2nd, teamPoints3rd);

	return {
		snatchPoints,
		cjPoints,
		totalPoints,
		combinedPoints: snatchPoints + cjPoints + totalPoints
	};
}

function computeScoreMetric(athlete, scoreSystem, competitionDate, scoringConfig) {
	const system = normalizeScoreSystem(scoreSystem);
	const total = parseNumber(athlete?.total);
	const bodyWeight = parseNumber(athlete?.bodyWeight || athlete?.presumedBodyWeight);
	const gender = normalizeGender(athlete?.gender);
	const age = calculateAge(athlete, competitionDate);
	const {
		sinclairYear,
		smhfOverrideSinclairYear = DEFAULT_SMHF_SINCLAIR_YEAR,
		smhfAgeFactorYear = DEFAULT_SMHF_AGE_FACTOR_YEAR
	} = scoringConfig;

	if (total <= 0) {
		return 0;
	}

	switch (system) {
		case 'BW_SINCLAIR':
		case 'SINCLAIR':
			return CalculateSinclair(total, bodyWeight, gender, sinclairYear);
		case 'SMM':
		case 'SMHF':
			return CalculateSinclairMasters(total, bodyWeight, gender, age, smhfOverrideSinclairYear, smhfAgeFactorYear);
		case 'Q_POINTS':
		case 'QPOINTS':
			return CalculateQPoints(total, bodyWeight, gender, 0);
		case 'Q_MASTERS':
		case 'QMASTERS':
			return CalculateQPoints(total, bodyWeight, gender, age);
		case 'GAMX':
			return computeGamx(gender, bodyWeight, total, Variant.SENIOR, null);
		case 'GAMX_M':
		case 'GAMX_MASTERS':
			return computeGamx(gender, bodyWeight, total, Variant.MASTERS, age);
		case 'GAMX_A':
		case 'CAT_GAMX':
			return computeGamx(gender, bodyWeight, total, Variant.AGE_ADJUSTED, age);
		case 'GAMX_U':
			return computeGamx(gender, bodyWeight, total, Variant.U17, age);
		case 'TOTAL':
		default:
			return total;
	}
}

function buildHeaders(locale) {
	return {
		rank: competitionHub.translate('Rank', locale),
		team: competitionHub.translate('Team', locale),
		count: competitionHub.getTranslations({ locale })?.Athletes || 'Athletes',
		liveScore: 'Live Score',
		confirmedScore: 'Confirmed Score',
		confirmedPoints: 'Points',
		snatchPoints: 'Snatch Points',
		cjPoints: 'C&J Points',
		totalPoints: 'Total Points',
		waitingForData: competitionHub.getTranslations({ locale })?.['Tracker.WaitingForData'] || 'Waiting for competition data...'
	};
}

function createCandidate(athlete, participation, championship, competitionDate, doneSessions, scoringConfig) {
	const teamName = resolveTeamName(athlete);
	if (!teamName || teamName.trim().toLowerCase() === 'unaffiliated') {
		return null;
	}

	const bodyWeight = parseNumber(athlete?.bodyWeight || athlete?.presumedBodyWeight);
	const total = parseNumber(athlete?.total);
	const bestSnatch = parseNumber(athlete?.bestSnatch);
	const bestCleanJerk = parseNumber(athlete?.bestCleanJerk);
	const groupDone = athlete?.sessionName ? doneSessions.has(String(athlete.sessionName)) : false;

	return {
		athlete,
		participation,
		teamName,
		teamId: athlete?.team,
		gender: normalizeGender(athlete?.gender),
		bodyWeight,
		total,
		bestSnatch,
		bestCleanJerk,
		groupDone,
		sortName: `${athlete?.lastName || ''} ${athlete?.firstName || ''}`.trim(),
		flagUrl: athlete?.flagUrl || athlete?.flagURL || getFlagUrl(teamName, true),
		scoreMetric: computeScoreMetric(athlete, championship?.teamScoringSystem, competitionDate, scoringConfig),
		mixedScoreMetric: computeScoreMetric(athlete, championship?.mixedTeamScoringSystem, competitionDate, scoringConfig),
		primaryRank: getPrimaryRank(participation, 'TOTAL')
	};
}

function buildSectionCandidates(databaseState, championshipName, championship, sectionType, categoryCodeToChampionshipName, doneSessions, scoringConfig) {
	const competitionDate = getCompetitionDate(databaseState);
	const candidates = [];

	for (const athlete of databaseState?.athletes || []) {
		const athleteGender = normalizeGender(athlete?.gender);
		if ((sectionType === 'M' || sectionType === 'F') && athleteGender !== sectionType) {
			continue;
		}

		const participation = getParticipationForChampionship(athlete, championshipName, categoryCodeToChampionshipName);
		if (!participation) {
			continue;
		}

		let eligible = false;
		if (sectionType === 'MF') {
			eligible = championship?.explicitMixedTeamMembers ? participation.mixedTeamMember === true : participation.teamMember === true;
		} else {
			eligible = participation.teamMember === true;
		}

		if (!eligible) {
			continue;
		}

		const candidate = createCandidate(athlete, participation, championship, competitionDate, doneSessions, scoringConfig);
		if (!candidate) {
			continue;
		}

		candidate.scoreMetric = sectionType === 'MF'
			? candidate.mixedScoreMetric
			: computeScoreMetric(athlete, championship?.teamScoringSystem, competitionDate, scoringConfig);
		candidates.push(candidate);
	}

	return candidates;
}

function buildTeamRows(sectionCandidates, sectionType, championship, mode, onlyTotalPoints = false) {
	const teamMap = new Map();

	for (const candidate of sectionCandidates) {
		if (!teamMap.has(candidate.teamName)) {
			teamMap.set(candidate.teamName, []);
		}
		teamMap.get(candidate.teamName).push(candidate);
	}

	const rows = [];

	for (const [teamName, candidates] of teamMap.entries()) {
		const rosterSize = candidates.length;
		const countDenominator = getSectionDenominator(sectionType, championship, rosterSize);
		const pointOrder = [...candidates].sort(comparePointCandidates);
		const scoreOrder = [...candidates].sort(compareScoreCandidates);

		if (mode === 'points') {
			const selectedCandidates = selectCandidates(pointOrder, sectionType, championship);
			const doneSelectedCount = selectedCandidates.filter((candidate) => candidate.groupDone).length;
			const pointTotals = selectedCandidates.reduce((totals, candidate) => {
				if (!candidate.groupDone) {
					return totals;
				}

				const values = buildPointValues(candidate, championship);
				totals.snatchPoints += values.snatchPoints;
				totals.cjPoints += values.cjPoints;
				totals.totalPoints += values.totalPoints;
				totals.confirmedPoints += onlyTotalPoints || !championship?.snatchCJTotalMedals ? values.totalPoints : values.combinedPoints;
				return totals;
			}, {
				snatchPoints: 0,
				cjPoints: 0,
				totalPoints: 0,
				confirmedPoints: 0
			});

			rows.push({
				teamName,
				flagUrl: candidates[0]?.flagUrl || null,
				countNumerator: doneSelectedCount,
				countDenominator,
				isMultiMedals: championship?.snatchCJTotalMedals === true,
				confirmedPoints: pointTotals.confirmedPoints,
				snatchPoints: pointTotals.snatchPoints,
				cjPoints: pointTotals.cjPoints,
				totalPoints: pointTotals.totalPoints,
				sortValue: pointTotals.confirmedPoints,
				stableName: teamName
			});
			continue;
		}

		const liveSelected = selectCandidates(scoreOrder, sectionType, championship);
		const confirmedSelected = selectCandidates(scoreOrder.filter((candidate) => candidate.groupDone), sectionType, championship);

		const liveScore = liveSelected.reduce((sum, candidate) => sum + candidate.scoreMetric, 0);
		const confirmedScore = confirmedSelected.reduce((sum, candidate) => sum + candidate.scoreMetric, 0);
		const countNumerator = liveSelected.filter((candidate) => candidate.scoreMetric > 0).length;

		rows.push({
			teamName,
			flagUrl: candidates[0]?.flagUrl || null,
			countNumerator,
			countDenominator,
			liveScore,
			confirmedScore,
			sortValue: confirmedScore,
			stableName: teamName
		});
	}

	rows.sort((left, right) => {
		if (right.sortValue !== left.sortValue) {
			return right.sortValue - left.sortValue;
		}
		return left.stableName.localeCompare(right.stableName, undefined, { sensitivity: 'base' });
	});

	while (rows.length < TEMPORARY_MIN_TEAMS_PER_SECTION) {
		const index = rows.length + 1;
		rows.push({
			teamName: `Demo Team ${String(index).padStart(2, '0')}`,
			flagUrl: null,
			countNumerator: 0,
			countDenominator: 0,
			isMultiMedals: championship?.snatchCJTotalMedals === true,
			confirmedPoints: 0,
			snatchPoints: 0,
			cjPoints: 0,
			totalPoints: 0,
			liveScore: 0,
			confirmedScore: 0,
			sortValue: Number.NEGATIVE_INFINITY,
			stableName: `zz-demo-team-${String(index).padStart(2, '0')}`,
			isDummy: true
		});
	}

	return rows.map((row, index) => ({
		...row,
		rank: index + 1
	}));
}

function buildPagesForSection(sectionRows, championshipName, sectionType, locale, options) {
	if (sectionRows.length === 0) {
		return [];
	}

	const sectionInfo = SECTION_CONFIG[sectionType];
	const pageSize = Math.max(1, parseNumber(options?.pageSize) || DEFAULT_PAGE_SIZE);
	const teamLimit = Math.max(0, parseNumber(options?.teamLimit) || 0);
	const limitedRows = teamLimit > 0 ? sectionRows.slice(0, teamLimit) : sectionRows;
	const pageCount = Math.ceil(limitedRows.length / pageSize);
	const mode = sectionRows[0]?.liveScore != null ? 'score' : 'points';
	const sectionLabel = `${championshipName} ${sectionInfo.label}`;
	const headers = buildHeaders(locale);

	return Array.from({ length: pageCount }, (_, pageIndex) => ({
		pageKey: `${championshipName}-${sectionType}-${pageIndex + 1}`,
		championshipName,
		sectionType,
		sectionLabel,
		sectionColorVariant: sectionInfo.variant,
		pageNumber: pageIndex + 1,
		pageCount,
		headers,
		mode,
		onlyTotalPoints: options?.onlyTotalPoints === true,
		rows: limitedRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
	}));
}

function hasMixedConfiguration(championship) {
	return Boolean(
		championship?.mixedTeamEnabled ||
		championship?.explicitMixedTeamMembers ||
		championship?.mixedTeamScoringSystem ||
		positiveCap(championship?.mixedBestN) != null ||
		positiveCap(championship?.mixedMensBestN) != null ||
		positiveCap(championship?.mixedWomensBestN) != null
	);
}

export function getScoreboardData(_fopName = '*', options = {}) {
	const databaseState = competitionHub.getDatabaseState();
	const locale = options?.lang || options?.language || 'en';
	const headers = buildHeaders(locale);
	const competitionSinclairYear = getCompetitionSinclairYear(databaseState);
	const scoringConfig = {
		sinclairYear: competitionSinclairYear,
		smhfOverrideSinclairYear: resolveSinclairYearOption(options?.smhfOverrideSinclairYear, competitionSinclairYear, DEFAULT_SMHF_SINCLAIR_YEAR),
		smhfAgeFactorYear: normalizeMastersAgeFactorYear(options?.smhfAgeFactorYear, DEFAULT_SMHF_AGE_FACTOR_YEAR)
	};

	if (!databaseState?.athletes || !databaseState?.championshipMap) {
		return {
			scoreboardName: 'Team Rankings',
			competition: { name: databaseState?.competition?.competitionName || 'Competition' },
			status: 'waiting',
			message: headers.waitingForData,
			headers,
			options: {
				smhfOverrideSinclairYear: scoringConfig.smhfOverrideSinclairYear,
				smhfAgeFactorYear: scoringConfig.smhfAgeFactorYear,
				pageSize: Math.max(1, parseNumber(options?.pageSize) || DEFAULT_PAGE_SIZE),
				pagePauseMs: Math.max(500, parseNumber(options?.pagePauseMs) || 5000),
				sweepDurationMs: Math.max(200, parseNumber(options?.sweepDurationMs) || 1200),
				championships: [],
				teamLimit: Math.max(0, parseNumber(options?.teamLimit) || 0),
				onlyTotalPoints: options?.onlyTotalPoints === true || String(options?.onlyTotalPoints).toLowerCase() === 'true'
			},
			pages: []
		};
	}

	const normalizedOptions = {
		smhfOverrideSinclairYear: scoringConfig.smhfOverrideSinclairYear,
		smhfAgeFactorYear: scoringConfig.smhfAgeFactorYear,
		pageSize: Math.max(1, parseNumber(options?.pageSize) || DEFAULT_PAGE_SIZE),
		pagePauseMs: Math.max(500, parseNumber(options?.pagePauseMs) || 5000),
		sweepDurationMs: Math.max(200, parseNumber(options?.sweepDurationMs) || 1200),
		championships: parseChampionshipFilter(options?.championships),
		teamLimit: Math.max(0, parseNumber(options?.teamLimit) || 0),
		onlyTotalPoints: options?.onlyTotalPoints === true || String(options?.onlyTotalPoints).toLowerCase() === 'true'
	};

	const cacheKey = JSON.stringify({
		lastUpdate: databaseState?.lastUpdate || 0,
		checksum: databaseState?.databaseChecksum || null,
		locale,
		normalizedOptions: {
			sinclairYear: scoringConfig.sinclairYear,
			smhfOverrideSinclairYear: normalizedOptions.smhfOverrideSinclairYear,
			smhfAgeFactorYear: normalizedOptions.smhfAgeFactorYear,
			pageSize: normalizedOptions.pageSize,
			pagePauseMs: normalizedOptions.pagePauseMs,
			sweepDurationMs: normalizedOptions.sweepDurationMs,
			championships: normalizedOptions.championships ? [...normalizedOptions.championships] : null,
			teamLimit: normalizedOptions.teamLimit,
			onlyTotalPoints: normalizedOptions.onlyTotalPoints
		}
	});

	if (rankingsCache.has(cacheKey)) {
		return rankingsCache.get(cacheKey);
	}

	const { categoryCodeToChampionshipName, activeChampionshipNames } = buildCategoryCodeMap(databaseState);
	const doneSessions = buildDoneSessionSet(databaseState);
	const selectedChampionshipNames = normalizedOptions.championships
		? activeChampionshipNames.filter((name) => normalizedOptions.championships.has(name))
		: activeChampionshipNames;

	const pages = [];

	for (const championshipName of selectedChampionshipNames) {
		const championship = databaseState.championshipMap[championshipName];
		if (!championship) {
			continue;
		}

		for (const sectionType of ['M', 'F']) {
			const candidates = buildSectionCandidates(databaseState, championshipName, championship, sectionType, categoryCodeToChampionshipName, doneSessions, scoringConfig);
			if (candidates.length === 0) {
				continue;
			}

			const mode = getScoreMode(sectionType, championship);
			const rows = buildTeamRows(candidates, sectionType, championship, mode, normalizedOptions.onlyTotalPoints);
			pages.push(...buildPagesForSection(rows, championshipName, sectionType, locale, normalizedOptions));
		}

		if (!hasMixedConfiguration(championship)) {
			continue;
		}

		const mixedCandidates = buildSectionCandidates(databaseState, championshipName, championship, 'MF', categoryCodeToChampionshipName, doneSessions, scoringConfig);
		if (mixedCandidates.length === 0) {
			continue;
		}

		const mixedMode = getScoreMode('MF', championship);
		const mixedRows = buildTeamRows(mixedCandidates, 'MF', championship, mixedMode, normalizedOptions.onlyTotalPoints);
		pages.push(...buildPagesForSection(mixedRows, championshipName, 'MF', locale, normalizedOptions));
	}

	const result = {
		scoreboardName: 'Team Rankings',
		competition: {
			name: databaseState?.competition?.competitionName || 'Competition'
		},
		status: pages.length > 0 ? 'ready' : 'waiting',
		message: pages.length > 0 ? null : headers.waitingForData,
		headers,
		options: {
			smhfOverrideSinclairYear: normalizedOptions.smhfOverrideSinclairYear,
			smhfAgeFactorYear: normalizedOptions.smhfAgeFactorYear,
			pageSize: normalizedOptions.pageSize,
			pagePauseMs: normalizedOptions.pagePauseMs,
			sweepDurationMs: normalizedOptions.sweepDurationMs,
			championships: selectedChampionshipNames,
			teamLimit: normalizedOptions.teamLimit,
			onlyTotalPoints: normalizedOptions.onlyTotalPoints
		},
		pages,
		lastUpdate: databaseState?.lastUpdate || Date.now()
	};

	rankingsCache.set(cacheKey, result);
	return result;
}

export default getScoreboardData;