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

// Copy dir and transform JS contents
function copyDirWithTransform(src, dest, transformFn) {
	fs.mkdirSync(dest, { recursive: true });
	const files = fs.readdirSync(src);

	files.forEach((file) => {
		const srcPath = path.join(src, file);
		const destPath = path.join(dest, file);
		const stats = fs.statSync(srcPath);

		if (stats.isDirectory()) {
			copyDirWithTransform(srcPath, destPath, transformFn);
			return;
		}

		if (file.endsWith('.js')) {
			const content = fs.readFileSync(srcPath, 'utf8');
			fs.writeFileSync(destPath, transformFn(content));
			return;
		}

		fs.copyFileSync(srcPath, destPath);
	});
}

try {
	const transformServerImports = (content) => {
		let updated = content;
		updated = updated.replace(/from '\$lib\/server\//g, "from './");
		updated = updated.replace(/from "\$lib\/server\//g, 'from "./');
		return updated;
	};

	copyDirWithTransform(src, dest, transformServerImports);
	console.log(`✓ Copied ${src} to ${dest} (with $lib paths transformed)`);
} catch (err) {
	console.error('✗ Failed to copy runtime server files:', err.message);
	process.exit(1);
}

// Copy production entry point to build folder
try {
	const startSrc = 'scripts/start-production.js';
	const startDest = 'build/start.js';
	fs.copyFileSync(startSrc, startDest);
	console.log(`✓ Copied ${startSrc} to ${startDest}`);
} catch (err) {
	console.error('✗ Failed to copy production entry point:', err.message);
	process.exit(1);
}

// Copy Paged.js polyfill to static folder (needed for production builds)
try {
	const pagedSrc = 'node_modules/pagedjs/dist/paged.polyfill.js';
	const pagedDest = 'static/paged.polyfill.js';
	fs.copyFileSync(pagedSrc, pagedDest);
	console.log(`✓ Copied ${pagedSrc} to ${pagedDest}`);
} catch (err) {
	console.error('✗ Failed to copy Paged.js polyfill:', err.message);
	process.exit(1);
}

// Copy team-scoreboard source for runtime plugin inheritance
// Derivative plugins (like équipes) import from this source at runtime
// We also transform $lib imports to relative paths for runtime compatibility
try {
	const teamSrc = 'src/plugins/teams/team-scoreboard';
	const teamDest = 'build/src/plugins/teams/team-scoreboard';
	
	// Copy directory structure
	fs.mkdirSync(teamDest, { recursive: true });
	const files = fs.readdirSync(teamSrc);
	
	for (const file of files) {
		const srcPath = path.join(teamSrc, file);
		const destPath = path.join(teamDest, file);
		
		if (file.endsWith('.js')) {
			// Transform $lib imports to relative paths for runtime
			let content = fs.readFileSync(srcPath, 'utf8');
			
			// $lib/server/* -> ../../../../lib/server/* (from build/src/plugins/teams/team-scoreboard)
			content = content.replace(
				/from '\$lib\/server\//g,
				"from '../../../../lib/server/"
			);
			content = content.replace(
				/from "\$lib\/server\//g,
				'from "../../../../lib/server/'
			);
			
			fs.writeFileSync(destPath, content);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
	
	console.log(`✓ Copied ${teamSrc} to ${teamDest} (for plugin inheritance, $lib paths transformed)`);
} catch (err) {
	console.error('✗ Failed to copy team-scoreboard source:', err.message);
	process.exit(1);
}

// Copy scoring coefficient files for runtime plugins
// team-scoreboard imports these with $lib alias which must resolve at runtime
try {
	const libSrc = 'src/lib';
	const libDest = 'build/src/lib';
	
	// Copy specific files needed by team-scoreboard
	const files = ['sinclair-coefficients.js', 'qpoints-coefficients.js', 'gamx2.js'];
	fs.mkdirSync(libDest, { recursive: true });
	
	for (const file of files) {
		fs.copyFileSync(path.join(libSrc, file), path.join(libDest, file));
	}
	
	console.log(`✓ Copied scoring coefficient files to ${libDest} (for plugin inheritance)`);
} catch (err) {
	console.error('✗ Failed to copy scoring coefficient files:', err.message);
	process.exit(1);
}
