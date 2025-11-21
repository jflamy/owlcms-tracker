/**
 * Referee Assignments Scoreboard - Server-side helpers
 * 
 * This scoreboard displays referee and official assignments across all sessions/groups.
 * Structure: Top row shows session names, subsequent rows show different official types.
 */

import { competitionHub } from '$lib/server/competition-hub.js';

/**
 * Main function to get referee assignment data
 * @param {string} fopName - Field of play name (not used for this scoreboard, but required by system)
 * @param {object} options - User options
 * @returns {object} Referee assignment data structured for display
 */
export function getScoreboardData(fopName = 'A', options = {}) {
	const databaseState = competitionHub.getDatabaseState();
	
	if (!databaseState || !databaseState.competition) {
		return {
			status: 'no_data',
			message: 'No competition data available',
			sessions: [],
			assignmentRows: []
		};
	}

	const groups = databaseState.groups || [];
	
	if (groups.length === 0) {
		return {
			status: 'no_groups',
			message: 'No sessions/groups found in competition',
			sessions: [],
			assignmentRows: []
		};
	}

	// Sort groups by name (which is typically "1", "2", etc.)
	const sortedGroups = [...groups].sort((a, b) => {
		const aNum = parseInt(a.name, 10);
		const bNum = parseInt(b.name, 10);
		return aNum - bNum;
	});

	// Define official types and their corresponding field names
	const officialTypes = [
		{
			label: 'Referee 1',
			field: 'referee1',
			type: 'referee1'
		},
		{
			label: 'Referee 2',
			field: 'referee2',
			type: 'referee2'
		},
		{
			label: 'Referee 3',
			field: 'referee3',
			type: 'referee3'
		},
		{
			label: 'Jury 1',
			field: 'jury1',
			type: 'jury1'
		},
		{
			label: 'Jury 2',
			field: 'jury2',
			type: 'jury2'
		},
		{
			label: 'Jury 3',
			field: 'jury3',
			type: 'jury3'
		},
		{
			label: 'Jury 4',
			field: 'jury4',
			type: 'jury4'
		},
		{
			label: 'Jury 5',
			field: 'jury5',
			type: 'jury5'
		},
		{
			label: 'Technical Controller',
			field: 'technicalController',
			type: 'technicalController'
		},
		{
			label: 'Time Keeper',
			field: 'timeKeeper',
			type: 'timeKeeper'
		},
		{
			label: 'Marshal',
			field: 'marshall',
			type: 'marshall'
		}
	];

	// Build the assignment table
	// Each row represents an official type, each column represents a session
	const assignmentRows = officialTypes.map(officialType => ({
		label: officialType.label,
		type: officialType.type,
		assignments: sortedGroups.map(group => {
			const value = group[officialType.field];
			// Handle null, undefined, or empty string
			return {
				name: (value && value.trim()) || '—',
				isEmpty: !value || value.trim() === ''
			};
		})
	}));

	return {
		status: 'ready',
		competition: {
			name: databaseState.competition?.name || 'Competition'
		},
		sessions: sortedGroups.map(group => ({
			id: group.id,
			name: group.name,
			description: group.description,
			displayName: `${group.name}: ${group.description}`
		})),
		assignmentRows,
		totalSessions: sortedGroups.length,
		totalOfficialTypes: officialTypes.length
	};
}
