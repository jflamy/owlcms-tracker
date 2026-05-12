const PDF_TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2} \d{2}h\d{2}$/;

function pad2(value) {
	return String(value).padStart(2, '0');
}

export function formatPdfTimestamp(date = new Date()) {
	const year = date.getFullYear();
	const month = pad2(date.getMonth() + 1);
	const day = pad2(date.getDate());
	const hours = pad2(date.getHours());
	const minutes = pad2(date.getMinutes());

	return `${year}-${month}-${day} ${hours}h${minutes}`;
}

export function appendPdfTimestamp(filenameBase, timestamp = formatPdfTimestamp()) {
	const base = String(filenameBase || '').trim();
	if (!base) {
		return timestamp;
	}
	if (PDF_TIMESTAMP_PATTERN.test(base)) {
		return base;
	}
	return `${base} - ${timestamp}`;
}

export function sanitizePdfFilename(filename) {
	return String(filename || '')
		.replace(/[<>:"/\\|?*]/g, '-')
		.replace(/\s+/g, ' ')
		.trim();
}
