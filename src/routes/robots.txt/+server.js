import { error } from '@sveltejs/kit';

export async function GET() {
	// Return a proper 404 for robots.txt
	throw error(404, 'robots.txt not found');
}