import { getScoreboardData } from './helpers.data.js';

export async function load({ url }) {
	const fopName = url.searchParams.get('fop') || 'A';
	const position = url.searchParams.get('position') || 'bottom-right';
	const fontSize = url.searchParams.get('fontSize') || 'medium';

	const data = getScoreboardData(fopName, {
		position,
		fontSize
	});

	return data;
}
