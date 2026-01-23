/**
 * Proxy endpoint for OWLCMS pages
 * 
 * Forwards requests to OWLCMS server configured in display-control.
 * Path: /proxy/* → http://{owlcmsUrl}/*
 * 
 * Example:
 * /proxy/displays/publicScoreboard?fop=A
 * → http://192.168.1.42:8080/displays/publicScoreboard?fop=A
 */

import { error } from '@sveltejs/kit';
import { getScoreboardData } from '../../../plugins/video-overlays/display-control/helpers.data.js';

export async function GET({ params, url }) {
	const targetPath = params.path || '';
	const fop = url.searchParams.get('fop') || url.searchParams.get('fopName') || 'A';
	
	try {
		// Get display-control config for this FOP
		const controlState = getScoreboardData(fop);
		const owlcmsUrl = controlState?.config?.owlcmsUrl || 'http://localhost:8080';
		
		console.log(`[Proxy] FOP=${fop}, owlcmsUrl=${owlcmsUrl}, path=${targetPath}`);
		
		// Build target URL - ensure owlcmsUrl doesn't have trailing slash
		const baseUrl = owlcmsUrl.replace(/\/$/, '');
		const targetUrl = `${baseUrl}/${targetPath}${url.search}`;
		
		console.log(`[Proxy] Fetching: ${targetUrl}`);
		
		// Forward request to OWLCMS
		const response = await fetch(targetUrl, {
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'User-Agent': 'OWLCMS-Tracker-Proxy/1.0'
			}
		});
		
		if (!response.ok) {
			console.error(`[Proxy] OWLCMS error ${response.status}: ${targetUrl}`);
			throw error(response.status, `OWLCMS returned ${response.status}`);
		}
		
		// Get content and headers
		const content = await response.text();
		const contentType = response.headers.get('content-type') || 'text/html';
		
		console.log(`[Proxy] Success: ${content.length} bytes, ${contentType}`);
		
		// Return with original content-type
		return new Response(content, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'X-Proxied-From': owlcmsUrl
			}
		});
		
	} catch (err) {
		console.error('[Proxy] Error:', err.message);
		throw error(502, `Proxy error: ${err.message}`);
	}
}
