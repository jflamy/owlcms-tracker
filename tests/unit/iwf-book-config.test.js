import { describe, expect, it } from 'vitest';

import startbookConfig from '../../src/plugins/books/iwf-startbook/config.js';
import resultsConfig from '../../src/plugins/books/iwf-results/config.js';
import refereeAssignmentsConfig from '../../src/plugins/documents/referee-assignments/config.js';

describe('IWF book config language selector', () => {
  const refereeLanguageOption = refereeAssignmentsConfig.options[0];

  it('uses the referee assignment language selector as the first start book option', () => {
    expect(startbookConfig.options[0]).toEqual(refereeLanguageOption);
  });

  it('uses the referee assignment language selector as the first results book option', () => {
    expect(resultsConfig.options[0]).toEqual(refereeLanguageOption);
  });
});