import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';
import { extractTimerAndDecisionState } from '$lib/server/timer-decision-helpers.js';
import { buildCacheKey, registerCache } from '$lib/server/cache-utils.js';

// Plugin cache for lower-third
const lowerThirdCache = new Map();
registerCache(lowerThirdCache);

function decodeEntities(str) {
	if (!str) return '';
	return str
		.replace(/&ndash;/g, '–')
		.replace(/&mdash;/g, '—')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

function toTitleCase(value = '') {
	return String(value)
		.toLowerCase()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLastFirst({ firstName = '', lastName = '', fullName = '' } = {}) {
	const cleanFirst = decodeEntities(String(firstName || '').trim());
	const cleanLast = decodeEntities(String(lastName || '').trim());
	if (cleanLast && cleanFirst) {
		return `${cleanLast.toUpperCase()}, ${toTitleCase(cleanFirst)}`;
	}

	const normalizedFull = decodeEntities(String(fullName || '').trim());
	if (!normalizedFull) return '';
	if (!normalizedFull.includes(',')) return normalizedFull;

	const [last = '', ...rest] = normalizedFull.split(',');
	const first = rest.join(',').trim();
	return `${last.trim().toUpperCase()}, ${toTitleCase(first)}`;
}

function slugifyTeamName(teamName = '') {
	return String(teamName)
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function parsePositiveInt(value) {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function detectPlatformTheme({ fopName = '', fopUpdate = null } = {}) {
	const token = String(fopUpdate?.fopName || fopUpdate?.fop || fopName || '').toLowerCase();
	if (token.includes('gray') || token.includes('grey')) return 'gray';
	if (token.includes('scarlet')) return 'scarlet';
	return 'scarlet';
}

function resolvePlatformTheme({ options = {}, fopName = '', fopUpdate = null } = {}) {
	const requested = String(options?.platformTheme || 'auto').toLowerCase().trim();
	if (requested === 'gray' || requested === 'grey') return 'gray';
	if (requested === 'scarlet') return 'scarlet';
	return detectPlatformTheme({ fopName, fopUpdate });
}

function resolveCurrentAthleteEntry(fopUpdate) {
	const sessionAthletes = Array.isArray(fopUpdate?.sessionAthletes) ? fopUpdate.sessionAthletes : [];
	if (sessionAthletes.length === 0) return null;

	const byCurrentClass = sessionAthletes.find((entry) => {
		const className = String(entry?.displayInfo?.classname || '').toLowerCase();
		return className.includes('current');
	});
	if (byCurrentClass) return byCurrentClass;

	const fopName = String(fopUpdate?.fullName || '').trim();
	const byName = sessionAthletes.find((entry) => {
		const displayName = String(entry?.displayInfo?.fullName || '').trim();
		return displayName && fopName && displayName === fopName;
	});
	if (byName) return byName;

	const fopStart = parsePositiveInt(fopUpdate?.startNumber);
	if (fopStart != null) {
		const byStart = sessionAthletes.find((entry) => parsePositiveInt(entry?.athlete?.startNumber) === fopStart);
		if (byStart) return byStart;
	}

	return sessionAthletes[0] || null;
}

function normalizeAttemptCell(attempt) {
	if (!attempt) return { value: '', status: 'empty' };
	const rawValue = attempt.value ?? attempt.stringValue ?? '';
	const value = String(rawValue).replace(/\u00A0/g, ' ').trim();
	const status = String(attempt.status || attempt.liftStatus || 'empty').toLowerCase();
	return {
		value,
		status: value ? status : 'empty'
	};
}

function normalizeAttempts(attempts = []) {
	const normalized = Array.isArray(attempts) ? attempts.map(normalizeAttemptCell) : [];
	while (normalized.length < 3) normalized.push({ value: '', status: 'empty' });
	return normalized.slice(0, 3);
}

function formatPersonalBest(pb) {
	const value = parsePositiveInt(pb);
	return value != null ? `${value}kg` : 'PB -';
}

function resolveClubLogoUrl({ athlete, displayInfo, options, teamName, fallbackFlagUrl }) {
	const candidates = resolveClubLogoCandidates({ athlete, displayInfo, options, teamName, fallbackFlagUrl });
	return candidates[0] || null;
}

function resolveClubLogoCandidates({ athlete, displayInfo, options, teamName, fallbackFlagUrl }) {
	const uniqueCandidates = new Set();
	const pushCandidate = (value) => {
		if (!value) return;
		const normalized = String(value).trim();
		if (!normalized) return;
		uniqueCandidates.add(normalized);
	};

	const explicit =
		athlete?.clubLogoUrl || athlete?.clubLogoURL ||
		displayInfo?.clubLogoUrl || displayInfo?.clubLogoURL ||
		athlete?.teamLogoUrl || athlete?.teamLogoURL ||
		displayInfo?.teamLogoUrl || displayInfo?.teamLogoURL ||
		athlete?.logoUrl || athlete?.logoURL ||
		displayInfo?.logoUrl || displayInfo?.logoURL;
	pushCandidate(explicit);

	if (String(options?.clubLogoSource || '').toLowerCase() === 'flag') {
		pushCandidate(fallbackFlagUrl);
		return Array.from(uniqueCandidates);
	}

	const basePath = String(options?.clubLogoBasePath || '').trim();
	if (!basePath || !teamName) return Array.from(uniqueCandidates);

	const cleanBasePath = basePath.replace(/\/$/, '');
	const preferredExt = String(options?.clubLogoExt || 'jpg').replace(/^\.+/, '') || 'jpg';
	const extensions = Array.from(new Set([preferredExt, 'jpg', 'png', 'svg']));
	const rawName = String(teamName).trim();
	const encodedTeamName = encodeURIComponent(rawName);
	if (rawName) {
		for (const ext of extensions) {
			pushCandidate(`${cleanBasePath}/${rawName}.${ext}`);
			pushCandidate(`${cleanBasePath}/${encodedTeamName}.${ext}`);
		}
	}

	const slug = slugifyTeamName(teamName);
	if (slug) {
		for (const ext of extensions) {
			pushCandidate(`${cleanBasePath}/${slug}.${ext}`);
		}
	}

	return Array.from(uniqueCandidates);
}

export function getScoreboardData(fopName = 'A', options = {}) {
	const fopUpdate = competitionHub.getFopUpdate({ fopName });
	const databaseState = competitionHub.getDatabaseState();
	const sessionStatus = competitionHub.getSessionStatus({ fopName });
	const learningMode = process.env.LEARNING_MODE === 'true';

	// Parse options
	const position = options.position || 'bottom-right';
	const fontSize = options.fontSize || 'medium';
	const platformTheme = resolvePlatformTheme({ options, fopName, fopUpdate });
	const ohioLogoUrl = options.ohioLogoUrl || '/local/flags/OhioWSO.png';

	// Build cache key based on competition data
	const cacheKey = buildCacheKey({
		fopName,
		includeFop: true,
		opts: {
			position,
			fontSize,
				platformTheme,
			ohioLogoUrl,
				clubLogoBasePath: options.clubLogoBasePath || '/local/flags',
				clubLogoExt: options.clubLogoExt || 'jpg',
			clubLogoSource: options.clubLogoSource || 'none'
		}
	});

	if (lowerThirdCache.has(cacheKey)) {
		const cached = lowerThirdCache.get(cacheKey);
		// Always compute volatile fields (timer/decision/displayMode) fresh
		const { timer, breakTimer, decision, displayMode } = extractTimerAndDecisionState(fopUpdate, fopName);
		return {
			...cached,
			timer,
			breakTimer,
			decision,
			displayMode,
			sessionStatus,
			learningMode
		};
	}

	// If no data yet, return waiting state
	if (!fopUpdate && !databaseState) {
		return {
		competition: { name: 'Waiting for data...', fop: fopName },
		currentAthleteInfo: null,
		timer: { state: 'stopped', timeRemaining: 0, duration: 0, initialWarningMillis: -1, finalWarningMillis: -1 },
		breakTimer: { state: 'stopped', timeRemaining: 0, duration: 300000 },
		decision: { visible: false, isSingleReferee: false, ref1: null, ref2: null, ref3: null },
		displayMode: 'none',
		sessionStatus: { isDone: false, sessionName: '', lastActivity: 0 },
		status: 'waiting',
		options: {
			position,
			fontSize,
			platformTheme,
			ohioLogoUrl,
			clubLogoBasePath: options.clubLogoBasePath || '/local/flags',
			clubLogoExt: options.clubLogoExt || 'jpg',
			clubLogoSource: options.clubLogoSource || 'none'
		}
	};
	}

	// Extract competition info
	const competition = {
		name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
		fop: fopName
	};

	// Extract current athlete info
	let currentAthleteInfo = null;
	const currentEntry = resolveCurrentAthleteEntry(fopUpdate);
	const athlete = currentEntry?.athlete || null;
	const displayInfo = currentEntry?.displayInfo || null;

	// During interruption: use the break message from fullName
	if (fopUpdate?.mode === 'INTERRUPTION' && fopUpdate?.fullName) {
		let displayName = decodeEntities(fopUpdate.fullName);
		// Then split on ndash or mdash and take the last part
		const parts = displayName.split(/\s*[–—]\s*/);
		if (parts.length > 1) {
			displayName = parts[parts.length - 1];
		}
		currentAthleteInfo = {
			fullName: displayName,
			formattedName: displayName,
			clubName: '',
			clubLogoUrl: null,
			clubLogoCandidates: [],
			flagUrl: null,
			weight: '',
			attemptNumber: '',
			liftType: '',
			personalBest: 'PB -',
			snatchAttempts: normalizeAttempts([]),
			cleanJerkAttempts: normalizeAttempts([])
		};
	} else if (fopUpdate?.fullName && !sessionStatus.isDone && fopUpdate?.mode !== 'INTERRUPTION') {
		const rawAttemptNumber = parsePositiveInt(fopUpdate.attemptNumber);
		const isSnatchLift = rawAttemptNumber != null && rawAttemptNumber <= 3;
		const liftType = isSnatchLift ? 'Snatch' : 'Clean & Jerk';
		const teamName = decodeEntities(displayInfo?.teamName || athlete?.teamName || fopUpdate.teamName);
		const fallbackFlagUrl = fopUpdate.flagUrl || fopUpdate.flagURL || getFlagUrl(teamName);
		const personalBest = formatPersonalBest(isSnatchLift ? athlete?.personalBestSnatch : athlete?.personalBestCleanJerk);
		const clubLogoCandidates = resolveClubLogoCandidates({ athlete, displayInfo, options, teamName, fallbackFlagUrl });

		currentAthleteInfo = {
			fullName: decodeEntities(displayInfo?.fullName || fopUpdate.fullName),
			formattedName: formatLastFirst({
				firstName: athlete?.firstName,
				lastName: athlete?.lastName,
				fullName: displayInfo?.fullName || fopUpdate.fullName
			}),
			clubName: teamName,
			clubLogoUrl: clubLogoCandidates[0] || null,
			clubLogoCandidates,
			flagUrl: fallbackFlagUrl,
			weight: fopUpdate.weight || '',
			attemptNumber: rawAttemptNumber != null ? String(rawAttemptNumber) : '',
			liftType,
			personalBest,
			snatchAttempts: normalizeAttempts(displayInfo?.sattempts),
			cleanJerkAttempts: normalizeAttempts(displayInfo?.cattempts)
		};
	}

	// Extract timer, break timer, decision, and display mode using shared helper
	const { timer, breakTimer, decision, displayMode } = extractTimerAndDecisionState(fopUpdate, fopName);

	const result = {
		competition,
		currentAthleteInfo,
		timer,
		breakTimer,
		decision,
		displayMode,
		sessionStatus,
		status: 'ready',
		options: {
			position,
			fontSize,
			platformTheme,
			ohioLogoUrl,
			clubLogoBasePath: options.clubLogoBasePath || '/local/flags',
			clubLogoExt: options.clubLogoExt || 'jpg',
			clubLogoSource: options.clubLogoSource || 'none'
		}
	};

	// Cache result (exclude volatile fields)
	lowerThirdCache.set(cacheKey, {
		competition,
		currentAthleteInfo,
		sessionStatus,
		status: 'ready',
		options: {
			position,
			fontSize,
			platformTheme,
			ohioLogoUrl,
			clubLogoBasePath: options.clubLogoBasePath || '/local/flags',
			clubLogoExt: options.clubLogoExt || 'jpg',
			clubLogoSource: options.clubLogoSource || 'none'
		}
	});

	if (lowerThirdCache.size > 3) {
		const firstKey = lowerThirdCache.keys().next().value;
		const expiredEntry = lowerThirdCache.get(firstKey);
		if (expiredEntry) {
			if (expiredEntry.currentAthleteInfo) expiredEntry.currentAthleteInfo = null;
		}
		lowerThirdCache.delete(firstKey);
	}

	return result;
}
