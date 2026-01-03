/**
 * Attempt Board - Full screen display for current athlete
 * 
 * Matches the OWLCMS Attempt Board layout:
 * - Athlete name (last name, first name)
 * - Team name
 * - Start number in colored box
 * - Category
 * - Weight in kg (large, cyan)
 * - Barbell/plates visualization
 * - Attempt info (e.g., "C. & J. #2")
 * - Timer countdown (large, yellow/green)
 * - Decision lights (down signal or referee decisions)
 */

export default {
	name: 'Attempt Board',
	description: 'Full-screen display showing current athlete with weight, barbell plates visualization, timer, and decisions. Matches OWLCMS Attempt Board layout.',
	category: 'attempt-board',
	order: 30,
	requiresPictures: false,
	
	options: [
		{
			key: 'showPlates',
			label: 'Show Plates',
			type: 'boolean',
			default: true,
			description: 'Show barbell plate visualization'
		},
		{
			key: 'showTimer',
			label: 'Show Timer',
			type: 'boolean',
			default: true,
			description: 'Show countdown timer'
		},
		{
			key: 'showDecisions',
			label: 'Show Decisions',
			type: 'boolean',
			default: true,
			description: 'Show referee decision lights'
		}
	]
};
