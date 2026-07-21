import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { getCelebrationsMediaDirectory } from '$lib/server/celebrations-media.js';

const CLIP_FILENAMES = {
	'good-lift': 'goodLift.mp4',
	'no-lift': 'noLift.mp4',
	'new-record': 'newRecord.mp4'
};

function parseRange(rangeHeader, fileSize) {
	if (!rangeHeader) return null;

	const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
	if (!match) return false;

	const [, startValue, endValue] = match;
	if (!startValue && !endValue) return false;

	let start;
	let end;
	if (startValue) {
		start = Number(startValue);
		end = endValue ? Number(endValue) : fileSize - 1;
	} else {
		const suffixLength = Number(endValue);
		start = Math.max(0, fileSize - suffixLength);
		end = fileSize - 1;
	}

	if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= fileSize || end < start) {
		return false;
	}

	return { start, end: Math.min(end, fileSize - 1) };
}

export async function GET({ params, request }) {
	const directory = getCelebrationsMediaDirectory(params.source);
	const filename = CLIP_FILENAMES[params.clip];
	if (!directory || !filename) {
		throw error(404, 'Celebrations media source is unavailable');
	}

	const filePath = join(directory, filename);
	let fileSize;
	try {
		fileSize = (await stat(filePath)).size;
	} catch {
		throw error(404, 'Celebrations media clip is unavailable');
	}

	const range = parseRange(request.headers.get('range'), fileSize);
	if (range === false) {
		return new Response(null, {
			status: 416,
			headers: { 'Content-Range': `bytes */${fileSize}` }
		});
	}

	const start = range?.start ?? 0;
	const end = range?.end ?? fileSize - 1;
	const headers = {
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'no-store',
		'Content-Length': String(end - start + 1),
		'Content-Type': 'video/mp4'
	};

	if (range) {
		headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
	}

	return new Response(Readable.toWeb(createReadStream(filePath, { start, end })), {
		status: range ? 206 : 200,
		headers
	});
}