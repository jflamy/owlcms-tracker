export default {
  name: 'IWF Start Book',
  description: 'Start book with participation summary and session start lists',
  category: 'documents',
  order: 110,
  fopRequired: false,
  options: [
    {
      key: 'includeSessionStartLists',
      label: 'Include Session Start Lists',
      type: 'boolean',
      default: true,
      description: 'Include start lists for each session'
    },
    {
      key: 'includeOfficials',
      label: 'Include Officials on Session Start Lists',
      type: 'boolean',
      default: true,
      description: 'Show technical officials section on session start lists'
    }
  ]
};
