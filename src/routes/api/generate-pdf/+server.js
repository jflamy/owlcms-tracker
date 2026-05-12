/**
 * PDF Generation Endpoint using Puppeteer
 * 
 * Generates PDF with proper mixed page orientations using headless Chrome.
 * Uses system Chrome installation via puppeteer-core (lightweight).
 * 
 * URL: /api/generate-pdf?type=iwf-results&option1=value1
 * 
 * OPTIONAL DEPENDENCY: puppeteer-core must be installed for PDF generation.
 * If not installed, this endpoint returns a helpful error message.
 */

// Dynamic import - puppeteer-core is optional
let puppeteer = null;
try {
	puppeteer = (await import('puppeteer-core')).default;
} catch {
	// puppeteer-core not installed - will return error in handler
}

import { findChrome } from '$lib/server/chrome-finder.js';
import { appendPdfTimestamp, sanitizePdfFilename } from '$lib/pdf-filenames.js';

export async function GET({ url }) {
	// Check if puppeteer is available
	if (!puppeteer) {
		return new Response(JSON.stringify({
			success: false,
			error: 'PDF generation not available',
			message: 'puppeteer-core is not installed.\n\n' +
				'To enable PDF generation:\n' +
				'  npm install puppeteer-core\n\n' +
				'You also need Chrome or Chromium installed on the system.\n\n' +
				'Alternative: Open the document in your browser and use Print → Save as PDF'
		}), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Check if we're in dev mode - self-requests cause deadlock
	const isDev = process.env.NODE_ENV === 'development';
	if (isDev) {
		return new Response(JSON.stringify({
			success: false,
			error: 'PDF generation not available in dev mode',
			message: 'The SvelteKit dev server cannot handle self-requests. To generate PDFs:\n\n' +
				'1. Build the app: npm run build\n' +
				'2. Run production: npm run preview\n' +
				'3. Then use the PDF generation\n\n' +
				'Or open the document in your browser and use Print → Save as PDF'
		}), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	
	try {
		// Extract parameters
		const type = url.searchParams.get('type') || 'iwf-results';
		
		// Build scoreboard URL with all parameters
		const params = new URLSearchParams();
		for (const [key, value] of url.searchParams.entries()) {
			if (key !== 'type') {
				params.append(key, value);
			}
		}
		
		// Use localhost directly - this endpoint runs on the same server
		const port = process.env.PORT || 8096;
		const scoreboardUrl = `http://localhost:${port}/${type}?${params.toString()}`;
		
		console.log(`[PDF Generator] Rendering: ${scoreboardUrl}`);
		
		// Find Chrome executable
		const executablePath = await findChrome();
		if (!executablePath) {
			return new Response(JSON.stringify({
				success: false,
				error: 'Chrome not found',
				message: 'Could not find Chrome/Chromium installation. Please ensure Chrome is installed.'
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		console.log(`[PDF Generator] Using Chrome: ${executablePath}`);
		
		// Launch headless Chrome
		const browser = await puppeteer.launch({
			executablePath,
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		});
		
		const page = await browser.newPage();
		
		// Set a large viewport to ensure all content is visible
		// Paged.js needs to see the full content to paginate correctly
		await page.setViewport({ width: 1200, height: 800 });
		
		// Capture console messages from the browser for debugging
		page.on('console', msg => {
			console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
		});
		
		page.on('pageerror', err => {
			console.error(`[Browser Error] ${err.message}`);
		});
		
		// Navigate to the scoreboard page
		// Use 'domcontentloaded' - networkidle0 may never fire due to Vite HMR websocket
		console.log(`[PDF Generator] Loading page: ${scoreboardUrl}`);
		await page.goto(scoreboardUrl, {
			waitUntil: 'domcontentloaded',
			timeout: 60000
		});
		console.log('[PDF Generator] DOM loaded, waiting for content to render...');
		
		// Give Svelte time to hydrate and render all content
		await new Promise(resolve => setTimeout(resolve, 2000));
		
		// Check if this document uses Paged.js (has script tag loading pagedjs)
		const usesPagedJs = await page.evaluate(() => {
			// Check for Paged.js script or existing pagedjs elements
			const scripts = document.querySelectorAll('script[src*="paged"]');
			const pagedElements = document.querySelector('.pagedjs_pages');
			return scripts.length > 0 || pagedElements !== null;
		});
		
		if (usesPagedJs) {
			// Wait for Paged.js to finish rendering
			// Paged.js adds .pagedjs_pages class when done
			// Large documents (80+ pages) may take 2-3 minutes to render
			console.log('[PDF Generator] Waiting for Paged.js to start (looking for .pagedjs_pages)...');
			await page.waitForSelector('.pagedjs_pages', { timeout: 180000 });
			console.log('[PDF Generator] Paged.js started, waiting for page count to stabilize...');
			
			// Wait for page count to stabilize (no new pages for 2 seconds)
			// This is more reliable than the after hook for large documents
			let lastPageCount = 0;
			let stableCount = 0;
			const requiredStableChecks = 4; // 4 checks at 500ms = 2 seconds of stability
			
			while (stableCount < requiredStableChecks) {
				await new Promise(resolve => setTimeout(resolve, 500));
				const currentPageCount = await page.evaluate(() => {
					return document.querySelectorAll('.pagedjs_page').length;
				});
				
				if (currentPageCount === lastPageCount && currentPageCount > 0) {
					stableCount++;
					console.log(`[PDF Generator] Page count stable at ${currentPageCount} (${stableCount}/${requiredStableChecks})`);
				} else {
					stableCount = 0;
					console.log(`[PDF Generator] Page count changed: ${lastPageCount} -> ${currentPageCount}`);
				}
				lastPageCount = currentPageCount;
			}
			
			console.log(`[PDF Generator] Page count stabilized at ${lastPageCount} pages`);
			
			// Also wait for the ready flag if set (for TOC target-counter computation)
			const hasReadyFlag = await page.evaluate(() => window.__pagedjs_ready === true);
			if (!hasReadyFlag) {
				console.log('[PDF Generator] Waiting additional time for target-counter() computation...');
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
			console.log('[PDF Generator] Paged.js rendering complete');
			
			// Log Paged.js page info for debugging
			const pageInfo = await page.evaluate(() => {
				const pages = document.querySelectorAll('.pagedjs_page');
				return Array.from(pages).map((p, i) => {
					const style = window.getComputedStyle(p);
					return {
						index: i + 1,
						width: style.width,
						height: style.height,
						classes: p.className
					};
				});
			});
			console.log(`[PDF Generator] Paged.js generated ${pageInfo.length} pages`);
			pageInfo.slice(0, 3).forEach(p => {
				console.log(`  Page ${p.index}: ${p.width} x ${p.height}`);
			});
		} else {
			// Simple document without Paged.js - just wait a bit for any async rendering
			console.log('[PDF Generator] Simple document (no Paged.js), waiting for content...');
			await new Promise(resolve => setTimeout(resolve, 1000));
			console.log('[PDF Generator] Content ready');
		}
		
		// Extract page title for the filename
		const pageTitle = await page.title();
		console.log(`[PDF Generator] Page title: ${pageTitle}`);
		
		console.log('[PDF Generator] Page rendered, generating PDF...');
		
		// Use Chrome DevTools Protocol directly for print-to-PDF
		// This uses the same engine as browser "Save as PDF" which correctly
		// handles target-counter() and other CSS print features
		const client = await page.createCDPSession();
		const { data } = await client.send('Page.printToPDF', {
			printBackground: true,
			preferCSSPageSize: true,
			displayHeaderFooter: false,
			generateDocumentOutline: true,  // Enable PDF bookmarks
			scale: 1
		});
		
		// Convert base64 to buffer
		const pdf = Buffer.from(data, 'base64');
		
		await browser.close();
		
		console.log('[PDF Generator] PDF generated successfully');
		
		// Generate filename from page title, fallback to type.
		// Some pages already timestamp their title for browser Print -> Save as PDF.
		const filenameBase = appendPdfTimestamp(pageTitle || type);
		const sanitizedFilename = sanitizePdfFilename(`${filenameBase}.pdf`);
		
		return new Response(pdf, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
				'Cache-Control': 'no-cache'
			}
		});
		
	} catch (error) {
		console.error('[PDF Generator] Error:', error);
		return new Response(JSON.stringify({
			success: false,
			error: error.message,
			stack: error.stack
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
