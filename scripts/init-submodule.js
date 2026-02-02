#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const submoduleName = process.argv[2];

if (!submoduleName) {
	console.error('Usage: npm run init <submodule-name>');
	console.error('Example: npm run init books');
	console.error('         npm run init France');
	process.exit(1);
}

// Read .gitmodules to find submodule path and branch
const gitmodulesPath = join(projectRoot, '.gitmodules');
if (!existsSync(gitmodulesPath)) {
	console.error('.gitmodules file not found');
	process.exit(1);
}

const gitmodules = readFileSync(gitmodulesPath, 'utf8');
const submoduleRegex = new RegExp(
	`\\[submodule "([^"]*${submoduleName}[^"]*)"]\\s+path = ([^\\n]+)(?:\\s+url = ([^\\n]+))?(?:\\s+branch = ([^\\n]+))?`,
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

const [, fullName, path, url, branch] = match;

console.log(`Initializing submodule: ${fullName}`);
console.log(`  Path: ${path}`);
if (branch) console.log(`  Branch: ${branch}`);

try {
	// Initialize and fetch the submodule
	console.log('\nStep 1: Fetching submodule...');
	execSync(`git submodule update --init ${path}`, {
		cwd: projectRoot,
		stdio: 'inherit'
	});

	// Configure branch tracking if specified
	if (branch) {
		console.log(`\nStep 2: Configuring branch tracking (${branch})...`);
		execSync(`git config -f .gitmodules submodule.${path}.branch ${branch}`, {
			cwd: projectRoot,
			stdio: 'inherit'
		});
	}

	// Get latest from tracked branch
	if (branch) {
		console.log('\nStep 3: Fetching latest from branch...');
		execSync(`git submodule update --remote ${path}`, {
			cwd: projectRoot,
			stdio: 'inherit'
		});
	}

	console.log(`\n✓ Submodule "${fullName}" initialized successfully`);
	console.log(`\nTo remove: npm run deinit ${submoduleName}`);

} catch (error) {
	console.error(`\n✗ Failed to initialize submodule: ${error.message}`);
	process.exit(1);
}
