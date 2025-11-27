import { competitionHub } from '$lib/server/competition-hub.js';
import { getFlagUrl } from '$lib/server/flag-resolver.js';

const SCORE_METRICS = {
  total: {
    key: 'total',
    label: 'Team Total (kg)',
    decimals: 0,
    accessor: (athlete) => safeNumber(athlete.total) || (safeNumber(athlete.bestSnatch) + safeNumber(athlete.bestCleanJerk)),
    formatter: (value) => formatNumber(value, 0)
  },
  sinclair: {
    key: 'sinclair',
    label: 'Team Sinclair Points',
    decimals: 2,
    accessor: (athlete) => safeNumber(athlete.sinclair),
    formatter: (value) => formatNumber(value, 2)
  }
};

const DEFAULT_TOP_N = 3;
const MAX_TOP_N = 6;
const teamTotalsCache = new Map();

export function getScoreboardData(fopName = 'A', options = {}) {
  const databaseState = competitionHub.getDatabaseState();
  const fopUpdate = competitionHub.getFopUpdate(fopName);
  const sessionStatus = competitionHub.getSessionStatus(fopName);
  const sessionAthletes = competitionHub.getSessionAthletes(fopName);
  const currentAttempt = competitionHub.getCurrentAthlete(fopName);
  const learningMode = process.env.LEARNING_MODE === 'true' ? 'enabled' : 'disabled';

  if (!databaseState?.athletes?.length) {
    return buildWaitingPayload(fopName, learningMode);
  }

  const topN = normalizeTopN(options.topN);
  const gender = normalizeGender(options.gender);
  const metricKey = normalizeMetricKey(options.scoreMetric);
  const metricConfig = SCORE_METRICS[metricKey];
  const checksum = databaseState.databaseChecksum || databaseState.lastUpdate || 'no-db';
  const cacheKey = `${checksum}-${fopName}-${topN}-${gender}-${metricKey}`;

  if (teamTotalsCache.has(cacheKey)) {
    const cached = teamTotalsCache.get(cacheKey);
    return {
      ...cached,
      currentAttempt,
      timer: extractTimerState(fopUpdate),
      sessionStatus,
      learningMode
    };
  }

  const sessionClassMap = buildSessionClassMap(sessionAthletes);
  const teamLookup = buildTeamLookup(databaseState?.teams || []);

  const formattedAthletes = databaseState.athletes
    .map((athlete) => formatAthlete(athlete, teamLookup, sessionClassMap))
    .filter((athlete) => athlete && athlete.teamName && athlete.metricSources.total > 0);

  const filteredAthletes = gender === 'MF'
    ? formattedAthletes
    : formattedAthletes.filter((athlete) => athlete.gender === gender);

  const groupedTeams = groupAthletesByTeam(filteredAthletes);
  const rankedTeams = computeTeamRanks(groupedTeams, topN, metricConfig);

  const competition = {
    name: fopUpdate?.competitionName || databaseState?.competition?.name || 'Competition',
    fop: fopName,
    session: fopUpdate?.sessionName || '',
    metricLabel: metricConfig.label
  };

  const payload = {
    competition,
    currentAttempt,
    timer: extractTimerState(fopUpdate),
    sessionStatus,
    teams: rankedTeams,
    metric: {
      key: metricConfig.key,
      label: metricConfig.label,
      topN,
      gender
    },
    totals: {
      totalTeams: rankedTeams.length,
      totalAthletes: filteredAthletes.length
    },
    optionsUsed: {
      topN,
      gender,
      scoreMetric: metricConfig.key
    },
    status: 'ready',
    learningMode
  };

  teamTotalsCache.set(cacheKey, {
    ...payload,
    currentAttempt: undefined,
    learningMode: undefined,
    timer: undefined,
    sessionStatus: undefined
  });

  trimCache();

  return payload;
}

function buildWaitingPayload(fopName, learningMode) {
  return {
    competition: { name: 'Waiting for competition data', fop: fopName },
    currentAttempt: null,
    teams: [],
    metric: { key: 'total', label: 'Team Total (kg)', topN: DEFAULT_TOP_N, gender: 'MF' },
    totals: { totalTeams: 0, totalAthletes: 0 },
    optionsUsed: { topN: DEFAULT_TOP_N, gender: 'MF', scoreMetric: 'total' },
    timer: extractTimerState(null),
    sessionStatus: competitionHub.getSessionStatus(fopName),
    status: 'waiting',
    learningMode
  };
}

function normalizeTopN(value) {
  const parsed = Number.isFinite(value) ? value : parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TOP_N;
  }
  return Math.min(Math.max(parsed, 1), MAX_TOP_N);
}

function normalizeGender(value) {
  if (typeof value !== 'string') {
    return 'MF';
  }
  const upper = value.toUpperCase();
  return upper === 'M' || upper === 'F' ? upper : 'MF';
}

function normalizeMetricKey(value) {
  if (typeof value !== 'string') {
    return 'total';
  }
  const lower = value.toLowerCase();
  return SCORE_METRICS[lower] ? lower : 'total';
}

function buildTeamLookup(teams) {
  const lookup = new Map();
  for (const team of teams) {
    const id = team?.id ?? team?.teamId;
    const name = team?.name || team?.displayName || team?.code;
    if (id !== undefined && name) {
      lookup.set(String(id), name);
    }
  }
  return lookup;
}

function buildSessionClassMap(sessionAthletes) {
  const map = new Map();
  if (!Array.isArray(sessionAthletes)) {
    return map;
  }
  for (const athlete of sessionAthletes) {
    const key = normalizeKey(athlete?.athleteKey ?? athlete?.key ?? athlete?.id);
    if (key) {
      map.set(key, athlete?.classname || athlete?.className || '');
    }
  }
  return map;
}

function formatAthlete(raw, teamLookup, sessionClassMap) {
  if (!raw) return null;

  const athleteKey = normalizeKey(raw?.key ?? raw?.id ?? raw?.startNumber ?? raw?.lotNumber);
  const bestSnatch = ensureLift(raw.bestSnatch, raw.snatch1ActualLift, raw.snatch2ActualLift, raw.snatch3ActualLift);
  const bestCleanJerk = ensureLift(raw.bestCleanJerk, raw.cleanJerk1ActualLift, raw.cleanJerk2ActualLift, raw.cleanJerk3ActualLift);
  const total = safeNumber(raw.total) || (bestSnatch + bestCleanJerk);
  const sinclair = safeNumber(raw.sinclair);

  const teamId = raw.team !== undefined && raw.team !== null ? String(raw.team) : null;
  const teamName = raw.teamName || (teamId ? teamLookup.get(teamId) : null);
  if (!teamName) {
    return null;
  }

  const fullName = composeAthleteName(raw);
  const category = raw.categoryName || raw.category || raw.categoryCode || '';
  const classname = (athleteKey && sessionClassMap.get(athleteKey)) || '';

  return {
    athleteKey,
    fullName,
    category,
    gender: raw.gender || null,
    teamId,
    teamName,
    bestSnatch,
    bestCleanJerk,
    total,
    sinclair,
    metricSources: { total, sinclair },
    classname
  };
}

function groupAthletesByTeam(athletes) {
  const map = new Map();
  for (const athlete of athletes) {
    if (!athlete.teamName) continue;
    const key = athlete.teamName;
    if (!map.has(key)) {
      map.set(key, {
        teamName: athlete.teamName,
        teamId: athlete.teamId,
        flagUrl: getFlagUrl(athlete.teamName, true),
        athletes: []
      });
    }
    map.get(key).athletes.push(athlete);
  }
  return map;
}

function computeTeamRanks(teamMap, topN, metricConfig) {
  const teams = [];

  for (const team of teamMap.values()) {
    const sorted = [...team.athletes].sort((a, b) => metricConfig.accessor(b) - metricConfig.accessor(a));
    const topAthletes = sorted.slice(0, topN);
    if (topAthletes.length === 0) continue;

    const teamScore = topAthletes.reduce((sum, athlete) => sum + metricConfig.accessor(athlete), 0);
    const teamTotalKg = topAthletes.reduce((sum, athlete) => sum + athlete.total, 0);

    teams.push({
      ...team,
      teamScore,
      teamScoreDisplay: metricConfig.formatter(teamScore),
      totalKg: teamTotalKg,
      athletes: topAthletes.map((athlete, index) => ({
        rank: index + 1,
        fullName: athlete.fullName,
        category: athlete.category,
        gender: athlete.gender,
        bestSnatch: athlete.bestSnatch,
        bestCleanJerk: athlete.bestCleanJerk,
        total: athlete.total,
        sinclair: athlete.sinclair,
        classname: athlete.classname,
        scoreValue: metricConfig.accessor(athlete),
        scoreDisplay: metricConfig.formatter(metricConfig.accessor(athlete))
      }))
    });
  }

  teams.sort((a, b) => {
    if (b.teamScore !== a.teamScore) {
      return b.teamScore - a.teamScore;
    }
    return (b.totalKg || 0) - (a.totalKg || 0);
  });

  return teams.map((team, index) => ({
    rank: index + 1,
    ...team
  }));
}

function extractTimerState(fopUpdate) {
  return {
    state: fopUpdate?.athleteTimerEventType === 'StartTime' ? 'running' :
      fopUpdate?.athleteTimerEventType === 'StopTime' ? 'stopped' :
      fopUpdate?.athleteTimerEventType === 'SetTime' ? 'set' : 'stopped',
    timeRemaining: fopUpdate?.athleteMillisRemaining ? parseInt(fopUpdate.athleteMillisRemaining, 10) : 0,
    duration: fopUpdate?.timeAllowed ? parseInt(fopUpdate.timeAllowed, 10) : 60000,
    startTime: null
  };
}

function ensureLift(existingValue, ...attempts) {
  const existing = safeNumber(existingValue);
  if (existing > 0) {
    return existing;
  }
  const best = Math.max(0, ...attempts.map((attempt) => safeNumber(attempt)));
  return best > 0 ? best : 0;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '' || value === '-') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function composeAthleteName(athlete) {
  const last = athlete.lastName || '';
  const first = athlete.firstName || '';
  if (last && first) {
    return `${last.toUpperCase()}, ${first}`;
  }
  if (last) {
    return last.toUpperCase();
  }
  return first || athlete.fullName || '';
}

function normalizeKey(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function formatNumber(value, decimals = 0) {
  const num = safeNumber(value);
  if (num <= 0) {
    return '-';
  }
  return num.toFixed(decimals);
}

function trimCache(maxEntries = 8) {
  while (teamTotalsCache.size > maxEntries) {
    const [firstKey] = teamTotalsCache.keys();
    teamTotalsCache.delete(firstKey);
  }
}
