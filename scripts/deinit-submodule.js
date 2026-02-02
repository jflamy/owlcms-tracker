#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const submoduleName = process.argv[2];

if (!submoduleName) {
	console.error('Usage: npm run deinit <submodule-name>');
	console.error('Example: npm run deinit books');
	console.error('         npm run deinit France');
	process.exit(1);
}

// Read .gitmodules to find submodule path
const gitmodulesPath = join(projectRoot, '.gitmodules');
if (!existsSync(gitmodulesPath)) {
	console.error('.gitmodules file not found');
	process.exit(1);
}

const gitmodules = readFileSync(gitmodulesPath, 'utf8');
const submoduleRegex = new RegExp(
	`\\[submodule "([^"]*${submoduleName}[^"]*)"]\\s+path = ([^\\n]+)`,
	'i'
);

const match = gitmodules.match(submoduleRegex);
if (!match) {
	console.error(`Submodule "${submoduleName}" not found in .gitmodules`);
	console.error('Available submodules:');
	const allSubmodules = [...gitmodules.matchAll(/\[submodule "([^"]+)"\]/g)];
	allSubmodules.forEach(m => console.error(`  - ${m[1]}`));
	process.exit(1);
}

const [, fullName, path] = match;
const submodulePath = join(projectRoot, path);

console.log(`Deinitializing submodule: ${fullName}`);
console.log(`  Path: ${path}`);

if (!existsSync(submodulePath)) {
	console.log('\n✓ Submodule already removed');
	process.exit(0);
}

try {
	// Step 1: git submodule deinit (removes from .git/config)
	console.log('\nStep 1: Removing git configuration...');
	try {
		execSync(`git submodule deinit -f ${path}`, {
			cwd: projectRoot,
			stdio: 'inherit'
		});
	} catch (error) {
		// Ignore error if already deinitialized
		console.log('  (already deinitialized)');
	}

	// Step 2: Clean working directory
	console.log('\nStep 2: Cleaning working directory...');
	
	const items = readdirSync(submodulePath);
	const preserveFiles = ['readme.md', 'license.txt', 'license'];
	const shouldPreserve = (name) => 
		preserveFiles.includes(name.toLowerCase());

	let removedCount = 0;
	let preservedCount = 0;

	for (const item of items) {
		if (shouldPreserve(item)) {
			console.log(`  ✓ Preserving: ${item}`);
			preservedCount++;
			continue;
		}

		const itemPath = join(submodulePath, item);
		const isDir = statSync(itemPath).isDirectory();
		
		try {
			rmSync(itemPath, { recursive: true, force: true });
			console.log(`  ✗ Removed ${isDir ? 'directory' : 'file'}: ${item}`);
			removedCount++;
		} catch (error) {
			console.error(`  ⚠ Failed to remove ${item}: ${error.message}`);
		}
	}

	console.log(`\n✓ Submodule "${fullName}" deinitialized`);
	console.log(`  Removed: ${removedCount} items`);
	console.log(`  Preserved: ${preservedCount} items`);
	console.log(`\nTo restore: npm run init ${submoduleName}`);

} catch (error) {
	console.error(`\n✗ Failed to deinitialize submodule: ${error.message}`);
	process.exit(1);
}
