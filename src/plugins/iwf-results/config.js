export default {
  name: 'IWF Results',
  description: 'Results book with participants, medals, rankings, session protocols and records',
  category: 'documents',
  order: 111,
  fopRequired: false,
  options: [
    {
      key: 'format',
      label: 'Document Format',
      type: 'select',
      options: ['complete', 'protocols-only'],
      default: 'complete',
      description: 'Complete document (title, TOC, all sections) or session protocols only'
    },
    {
      key: 'session',
      label: 'Session Name',
      type: 'text',
      default: '',
      description: 'Filter by a specific session name (e.g., M1). Leave empty to show all sessions.'
    },
    {
      key: 'hideOfficials',
      label: 'Hide Officials',
      type: 'boolean',
      default: false,
      description: 'Hide the signature section at the bottom.'
    },
    {
      key: 'tp1',
      label: 'Team Points for 1st place',
      type: 'number',
      default: 28,
      description: 'Points awarded for 1st place in team ranking'
    },
    {
      key: 'tp2',
      label: 'Team Points for 2nd place',
      type: 'number',
      default: 26,
      description: 'Points awarded for 2nd place in team ranking'
    }
  ]
};
