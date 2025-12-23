export default {
  name: 'IWF Results',
  description: 'Official IWF competition protocol with multi-session support and official signatures.',
  category: 'documents',
  order: 101,
  options: [
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
    }
  ]
};
