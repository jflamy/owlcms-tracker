export default {
  name: 'IWF Start Book',
  description: 'Start book with participation summary and session start lists',
  category: 'documents',
  order: 110,
  fopRequired: false,
  options: [
    {
      key: 'includeCategoryParticipants',
      label: 'Include Category Participants Section',
      type: 'boolean',
      default: false,
      description: 'Include section showing all participants grouped by age group and category'
    },
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
