import fs from 'fs';
import path from 'path';

// Copies server-only runtime modules that are not bundled by SvelteKit/Vite,
// but are required by the production entrypoint (start-with-ws.js).

const src = 'src/lib/server';
const dest = 'build/lib/server';

// Create destination directory if it doesn't exist
fs.mkdirSync(path.dirname(dest), { recursive: true });

// Recursive copy function
function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	const files = fs.readdirSync(src);

	files.forEach((file) => {
		const srcPath = path.join(src, file);
		const destPath = path.join(dest, file);
		const stats = fs.statSync(srcPath);

		if (stats.isDirectory()) {
			copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	});
}

try {
	copyDir(src, dest);
	console.log(`✓ Copied ${src} to ${dest}`);
} catch (err) {
	console.error('✗ Failed to copy runtime server files:', err.message);
	process.exit(1);
}
