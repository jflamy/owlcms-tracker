/**
 * PDF Generation Endpoint using Puppeteer
 * 
 * Generates PDF with proper mixed page orientations using headless Chrome.
 * Uses system Chrome installation via puppeteer-core (lightweight).
 * 
 * URL: /api/generate-pdf?type=iwf-results&option1=value1
 */

import puppeteer from 'puppeteer-core';
import { findChrome } from '$lib/server/chrome-finder.js';

export async function GET({ url }) {
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
		
		// Capture console messages from the browser for debugging
		page.on('console', msg => {
			console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
		});
		
		page.on('pageerror', err => {
			console.error(`[Browser Error] ${err.message}`);
		});
		
		// Navigate to the scoreboard page - use 'load' instead of 'networkidle0' for faster initial load
		await page.goto(scoreboardUrl, {
			waitUntil: 'load',
			timeout: 30000
		});
		
		// Wait for Paged.js to finish rendering
		// Paged.js adds .pagedjs_pages class when done
		await page.waitForSelector('.pagedjs_pages', { timeout: 60000 });
		
		// Wait for our custom ready flag set by Paged.js after hook
		// This ensures target-counter() values are computed
		console.log('[PDF Generator] Waiting for Paged.js ready flag...');
		await page.waitForFunction(() => window.__pagedjs_ready === true, { timeout: 30000 });
		console.log('[PDF Generator] Paged.js ready flag detected');
		
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
		
		// Generate filename from page title, fallback to type
		// Title is "Result Book - Competition Name", so use that with .pdf extension
		const filename = pageTitle ? `${pageTitle}.pdf` : `${type}.pdf`;
		// Sanitize filename for Windows/Mac/Linux compatibility
		const sanitizedFilename = filename
			.replace(/[<>:"|?*]/g, '-')  // Replace invalid characters
			.replace(/\s+/g, ' ')         // Normalize whitespace
			.trim();
		
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
