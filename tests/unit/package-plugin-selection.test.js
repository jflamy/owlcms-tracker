import { existsSync } from 'fs';
import { describe, expect, it } from 'vitest';

import {
  computeBuildSelection,
  isCustomBuild,
  resolveSelectedPlugins,
  shouldCopyWorkspaceEntry
} from '../../scripts/package-shared.js';

describe('Zip packaging plugin selection', () => {
  it('resolves plugins by configured category or display name', () => {
    const byCategory = resolveSelectedPlugins({ selectedPluginCategories: ['documents'] });
    const byDisplayName = resolveSelectedPlugins({ selectedPlugins: ['Referee Assignments'] });

    expect(Array.from(byCategory.selectedStandardPluginPaths)).toContain('documents/referee-assignments');
    expect(Array.from(byDisplayName.selectedStandardPluginPaths)).toEqual(['documents/referee-assignments']);
  });

  it('narrows copied standard plugins to the explicit list', () => {
    const explicitPluginSelection = resolveSelectedPlugins({ selectedPluginCategories: ['documents'] });
    const selection = computeBuildSelection({
      selectedSubmodules: [],
      explicitPluginSelection,
      includeStandard: false,
      allowedExtensionDirs: []
    });

    expect(shouldCopyWorkspaceEntry('src/plugins/documents', true, selection)).toBe(true);
    expect(shouldCopyWorkspaceEntry('src/plugins/documents/referee-assignments/config.js', false, selection)).toBe(true);
    expect(shouldCopyWorkspaceEntry('src/plugins/scoreboards/lifting-order/config.js', false, selection)).toBe(false);
    expect(shouldCopyWorkspaceEntry('src/plugins/teams/team-scoreboard/config.js', false, selection)).toBe(false);
  });

  it('includes default-checkout standard plugins when standard is enabled', () => {
    const selection = computeBuildSelection({
      selectedSubmodules: [],
      explicitPluginSelection: resolveSelectedPlugins(),
      includeStandard: true,
      allowedExtensionDirs: []
    });

    expect(shouldCopyWorkspaceEntry('src/plugins/documents/referee-assignments/config.js', false, selection)).toBe(true);
    expect(shouldCopyWorkspaceEntry('src/plugins/scoreboards/lifting-order/config.js', false, selection)).toBe(true);
    expect(shouldCopyWorkspaceEntry('src/plugins/books/iwf-startbook/tests', true, selection)).toBe(false);
    expect(shouldCopyWorkspaceEntry('src/plugins/books/iwf-startbook/tests/iwf-startbook-options.test.js', false, selection)).toBe(false);
    expect(shouldCopyWorkspaceEntry('src/plugins/books/iwf-startbook/helpers.data.test.js', false, selection)).toBe(false);
  });

  it('does not treat submodule names as plugin selectors', () => {
    expect(() => resolveSelectedPlugins({ selectedPluginCategories: ['streaming'] }))
      .toThrow(/Requested plugin category\(s\) not found: streaming/);
  });

  const hasBooks = existsSync('src/plugins/books/iwf-startbook/config.js') && existsSync('src/plugins/books/iwf-results/config.js');
  const hasOBS = existsSync('src/plugins/OBS/streaming/config.js');
  const hasFranceTeamsExtension = existsSync('extensions/France/\u00e9quipes/config.js') && existsSync('src/plugins/teams/team-scoreboard/config.js');

  it.skipIf(!(hasBooks && hasOBS))('maps categories to their backing plugin submodules', () => {
    const explicitPluginSelection = resolveSelectedPlugins({
      selectedPluginCategories: ['documents', 'remote-control']
    });
    const selection = computeBuildSelection({
      selectedSubmodules: [],
      explicitPluginSelection,
      includeStandard: false,
      allowedExtensionDirs: []
    });

    expect(Array.from(explicitPluginSelection.selectedPluginSubmoduleTopLevels).sort()).toEqual(['OBS', 'books']);
    expect(shouldCopyWorkspaceEntry('src/plugins/books/iwf-startbook/config.js', false, selection)).toBe(true);
    expect(shouldCopyWorkspaceEntry('src/plugins/OBS/streaming/config.js', false, selection)).toBe(true);
    expect(shouldCopyWorkspaceEntry('src/plugins/scoreboards/lifting-order/config.js', false, selection)).toBe(false);
  });

  it.skipIf(!(hasBooks && hasOBS))('adds selected category extras on top of standard plugins when standard is enabled', () => {
    const explicitPluginSelection = resolveSelectedPlugins({ selectedPluginCategories: ['remote-control'] });
    const selection = computeBuildSelection({
      selectedSubmodules: [],
      explicitPluginSelection,
      includeStandard: true,
      allowedExtensionDirs: []
    });

    expect(shouldCopyWorkspaceEntry('src/plugins/OBS/streaming/config.js', false, selection)).toBe(true);
    expect(shouldCopyWorkspaceEntry('src/plugins/scoreboards/lifting-order/config.js', false, selection)).toBe(true);
  });

  it.skipIf(!hasFranceTeamsExtension)('includes an extension and its delegated base plugin', () => {
    const explicitPluginSelection = resolveSelectedPlugins({ selectedPlugins: ['France - \u00c9quipes'] });
    const selection = computeBuildSelection({
      selectedSubmodules: [],
      explicitPluginSelection,
      includeStandard: false,
      allowedExtensionDirs: Array.from(explicitPluginSelection.selectedExtensionSubmoduleTopLevels)
    });

    expect(Array.from(explicitPluginSelection.selectedExtensionSubmoduleTopLevels)).toEqual(['France']);
    expect(Array.from(explicitPluginSelection.selectedStandardPluginPaths)).toEqual(['teams/team-scoreboard']);
    expect(shouldCopyWorkspaceEntry('extensions/France/\u00e9quipes/config.js', false, selection)).toBe(true);
    expect(shouldCopyWorkspaceEntry('src/plugins/teams/team-scoreboard/config.js', false, selection)).toBe(true);
    expect(shouldCopyWorkspaceEntry('src/plugins/documents/referee-assignments/config.js', false, selection)).toBe(false);
  });

  it.skipIf(!hasFranceTeamsExtension)('includes extension selections by configured category', () => {
    const explicitPluginSelection = resolveSelectedPlugins({ selectedPluginCategories: ['team'] });

    expect(Array.from(explicitPluginSelection.selectedExtensionSubmoduleTopLevels)).toContain('France');
    expect(Array.from(explicitPluginSelection.selectedStandardPluginPaths)).toContain('teams/team-scoreboard');
  });

  it('marks any build other than plain standard as custom', () => {
    expect(isCustomBuild({ includeStandard: true })).toBe(false);
    expect(isCustomBuild({ includeStandard: false })).toBe(true);
    expect(isCustomBuild({ includeStandard: true, selectedPlugins: ['Referee Assignments'] })).toBe(true);
    expect(isCustomBuild({ includeStandard: true, selectedPluginCategories: ['documents'] })).toBe(true);
    expect(isCustomBuild({ includeStandard: true, selectedSubmodules: ['books'] })).toBe(true);
  });
});