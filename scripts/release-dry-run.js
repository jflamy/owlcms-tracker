#!/usr/bin/env node

/**
 * Dry-run test of release.js - Fetch tracker-core version only
 */

import https from 'https';
import { gt } from 'semver';

function fetchLatestGitHubTag(owner, repo) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/tags`,
      method: 'GET',
      headers: {
        'User-Agent': 'owlcms-tracker-release-script',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const tags = JSON.parse(data);
          
          if (!Array.isArray(tags) || tags.length === 0) {
            reject(new Error('No tags found in repository'));
            return;
          }

          // Filter for semver tags and sort by version using semver library
          const semverPattern = /^v?(\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?)$/;
          const semverTags = tags
            .map(tag => tag.name)
            .filter(name => semverPattern.test(name))
            .map(name => name.replace(/^v/, '')) // Remove leading 'v' if present
            .sort((a, b) => {
              // Use semver library for proper comparison (handles alpha < beta < rc)
              return gt(a, b) ? -1 : gt(b, a) ? 1 : 0; // Descending order
            });

          if (semverTags.length === 0) {
            reject(new Error('No valid semver tags found'));
            return;
          }

          console.log('All valid semver tags from owlcms/tracker-core:');
          semverTags.forEach((tag, i) => {
            console.log(`  ${i + 1}. ${tag}`);
          });

          resolve(semverTags[0]);
        } catch (error) {
          reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch tags from GitHub: ${error.message}`));
    });
  });
}

(async () => {
  console.log('🔍 DRY-RUN: Fetching latest tracker-core version from GitHub...\n');
  try {
    const version = await fetchLatestGitHubTag('owlcms', 'tracker-core');
    console.log(`\n✅ Latest version found: ${version}`);
    console.log(`\nThis would update owlcms-tracker to use tracker-core@${version}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
})();
