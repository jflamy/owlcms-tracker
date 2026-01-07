#!/usr/bin/env node

/**
 * Get the latest semver versions for owlcms-tracker and tracker-core from GitHub
 * 
 * Usage: node scripts/get-latest-versions.js
 */

import https from 'https';
import { gt, valid } from 'semver';

/**
 * Fetch latest semver tag from GitHub API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<string>} Latest semver tag
 */
function fetchLatestGitHubTag(owner, repo) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/tags`,
      method: 'GET',
      headers: {
        'User-Agent': 'owlcms-version-checker',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    console.log(`  Fetching: https://${options.hostname}${options.path}`);

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }

        try {
          const tags = JSON.parse(data);
          
          if (!Array.isArray(tags) || tags.length === 0) {
            reject(new Error('No tags found in repository'));
            return;
          }

          // Filter for valid semver tags and sort properly using semver library
          const validTags = tags
            .map(tag => tag.name)
            .map(name => name.replace(/^v/, '')) // Remove leading 'v' if present
            .filter(version => valid(version)) // Use semver.valid() to validate
            .sort((a, b) => {
              // Use semver.gt for proper comparison (handles prerelease correctly)
              return gt(a, b) ? -1 : gt(b, a) ? 1 : 0; // Descending order
            });

          if (validTags.length === 0) {
            reject(new Error('No valid semver tags found'));
            return;
          }

          resolve(validTags[0]);
        } catch (error) {
          reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch tags from GitHub: ${error.message}`));
    });
  });
}

async function main() {
  try {
    console.log('🔍 Fetching latest versions from GitHub...\n');
    
    const [trackerVersion, coreVersion] = await Promise.all([
      fetchLatestGitHubTag('owlcms', 'owlcms-tracker'),
      fetchLatestGitHubTag('owlcms', 'tracker-core')
    ]);

    console.log('📦 Latest Semver Versions:');
    console.log(`   owlcms-tracker:  ${trackerVersion}`);
    console.log(`   tracker-core:    ${coreVersion}`);
    console.log();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
