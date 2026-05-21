import { competitionHub } from '$lib/server/competition-hub.js';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

const configOverridePath = resolve(process.cwd(), 'src/plugins/jury/replays/config-override.js');
const savedOptionKeys = ['replaysBaseUrl', 'enableSlowMotion'];

function normalizeBooleanOption(value) {
	return value === true || value === 'true';
}

function buildConfigOverrideContent(options) {
	const defaults = {
		replaysBaseUrl: String(options?.replaysBaseUrl || '').trim(),
		enableSlowMotion: normalizeBooleanOption(options?.enableSlowMotion)
	};

	const optionBlocks = savedOptionKeys.map((key) => [
		'    {',
		`      key: ${JSON.stringify(key)},`,
		`      default: ${JSON.stringify(defaults[key])}`,
		'    }'
	].join('\n'));

	return [
		'// Runtime default overrides for this plugin.',
		'// The tracker reads only options[].default from this file.',
		'export default {',
		'  options: [',
		optionBlocks.join(',\n'),
		'  ]',
		'};',
		''
	].join('\n');
}

function saveDefaultOptions(options) {
	const content = buildConfigOverrideContent(options);
	mkdirSync(dirname(configOverridePath), { recursive: true });
	writeFileSync(configOverridePath, content, 'utf8');
}

function normalizeReplaySessionId(value) {
	return String(value || '')
		.trim()
		.replaceAll(' ', '_');
}

function compareDateTimeArrays(left, right) {
	const leftParts = Array.isArray(left) ? left : [];
	const rightParts = Array.isArray(right) ? right : [];
	const maxLength = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < maxLength; index += 1) {
		const leftValue = Number(leftParts[index] ?? 0);
		const rightValue = Number(rightParts[index] ?? 0);
		if (leftValue !== rightValue) {
			return leftValue - rightValue;
		}
	}

	return 0;
}

function buildFallbackSessions(databaseState) {
	const groupMap = new Map();
	for (const athlete of databaseState?.athletes || []) {
		const sessionName = athlete?.sessionName || athlete?.group || '';
		if (!sessionName || groupMap.has(sessionName)) {
			continue;
		}
		groupMap.set(sessionName, {
			name: sessionName,
			description: sessionName,
			platformName: ''
		});
	}
	return Array.from(groupMap.values());
}

export function getScoreboardData(_fopName = '*', options = {}) {
	const databaseState = competitionHub.getDatabaseState() || {};
	const rawSessions = Array.isArray(databaseState.sessions) && databaseState.sessions.length > 0
		? databaseState.sessions
		: buildFallbackSessions(databaseState);

	const trackerSessions = [...rawSessions]
		.sort((left, right) => {
			const timeCompare = compareDateTimeArrays(left?.competitionTime, right?.competitionTime);
			if (timeCompare !== 0) {
				return timeCompare;
			}
			return String(left?.name || '').localeCompare(String(right?.name || ''), undefined, {
				numeric: true,
				sensitivity: 'base'
			});
		})
		.map((session) => ({
			id: normalizeReplaySessionId(session?.name || session?.description || ''),
			name: session?.name || '',
			displayName: session?.description || session?.name || '',
			platformName: session?.platformName || '',
			competitionTime: Array.isArray(session?.competitionTime) ? session.competitionTime : null
		}))
		.filter((session) => session.id);

	return {
		trackerSessions,
		options
	};
}

export async function handleAction({ action, options = {} }) {
	if (action !== 'saveDefaultOptions') {
		return {
			success: false,
			error: 'unknown_action',
			message: `Unsupported replays action: ${action}`
		};
	}

	saveDefaultOptions(options);
	return {
		success: true,
		message: 'Replays defaults saved.',
		refreshRegistry: true,
		refreshData: true
	};
}

export default getScoreboardData;
