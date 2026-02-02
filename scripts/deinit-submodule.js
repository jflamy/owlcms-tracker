#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync, readdirSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

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

const [, fullName, submoduleRelPathRaw] = match;
const submoduleRelPath = submoduleRelPathRaw.trim();
const submodulePath = join(projectRoot, submoduleRelPath);

console.log(`Deinitializing submodule: ${fullName}`);
console.log(`  Path: ${submoduleRelPath}`);

// Files to preserve (case-insensitive matching)
const preserveFiles = ['readme.md', 'license.txt', 'license'];
const shouldPreserve = (name) => preserveFiles.includes(name.toLowerCase());

try {
	// Step 1: Backup files to preserve BEFORE git submodule deinit
	console.log('\nStep 1: Preserving important files...');
	const tempDir = join(tmpdir(), `submodule-backup-${Date.now()}`);
	mkdirSync(tempDir, { recursive: true });
	
	const preserved = [];
	if (existsSync(submodulePath)) {
		try {
			const items = readdirSync(submodulePath);
			for (const item of items) {
				if (shouldPreserve(item)) {
					const srcPath = join(submodulePath, item);
					const destPath = join(tempDir, item);
					try {
						copyFileSync(srcPath, destPath);
						preserved.push(item);
						console.log(`  ✓ Backed up: ${item}`);
					} catch (error) {
						console.log(`  ⚠ Could not backup ${item}: ${error.message}`);
					}
				}
			}
		} catch (error) {
			console.log(`  (directory not accessible, skipping backup)`);
		}
	} else {
		console.log(`  (directory does not exist, skipping backup)`);
	}

	// Step 2: git submodule deinit (removes from .git/config AND clears directory)
	console.log('\nStep 2: Running git submodule deinit...');
	try {
		execSync(`git submodule deinit -f ${submoduleRelPath}`, {
			cwd: projectRoot,
			stdio: 'inherit'
		});
	} catch (error) {
		console.log('  (already deinitialized or error occurred)');
	}

	// Step 3: Recreate directory and restore preserved files
	console.log('\nStep 3: Restoring preserved files...');
	
	// Ensure directory exists
	if (!existsSync(submodulePath)) {
		mkdirSync(submodulePath, { recursive: true });
		console.log(`  Created directory: ${submoduleRelPath}`);
	}
	
	// Restore preserved files
	let restoredCount = 0;
	for (const item of preserved) {
		const srcPath = join(tempDir, item);
		const destPath = join(submodulePath, item);
		try {
			copyFileSync(srcPath, destPath);
			console.log(`  ✓ Restored: ${item}`);
			restoredCount++;
		} catch (error) {
			console.error(`  ✗ Could not restore ${item}: ${error.message}`);
		}
	}

	// Cleanup temp directory
	try {
		rmSync(tempDir, { recursive: true, force: true });
	} catch (error) {
		// Ignore cleanup errors
	}

	console.log(`\n✓ Submodule "${fullName}" deinitialized`);
	console.log(`  Preserved files: ${restoredCount}`);
	console.log(`\nTo restore: npm run init ${submoduleName}`);

} catch (error) {
	console.error(`\n✗ Failed to deinitialize submodule: ${error.message}`);
	process.exit(1);
}
