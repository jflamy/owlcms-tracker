import { redirect } from '@sveltejs/kit';

export async function GET() {
	// Redirect to the SVG favicon
	throw redirect(301, '/favicon.svg');
}