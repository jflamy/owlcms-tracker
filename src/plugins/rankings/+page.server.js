import { getScoreboardData } from './helpers.data.js';

export async function load({ url }) {
	const fop = url.searchParams.get('fop') || 'A';
	const showRecords = url.searchParams.get('showRecords') === 'true';

	const data = getScoreboardData(fop, { showRecords });

	return {
		...data,
		fop
	};
}
