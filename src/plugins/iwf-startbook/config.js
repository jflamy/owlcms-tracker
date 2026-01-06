export default {
  name: 'IWF Start Book',
  description: 'Start book with participation summary and session start lists',
  category: 'documents',
  order: 110,
  fopRequired: false,
  
  // Required resources that must be loaded before this plugin can render
  // When accessed, missing resources will be requested from OWLCMS via 428
  requires: ['logos_zip'],
  
  options: [
    {
      key: 'includeCategoryParticipants',
      label: 'Include Category Participants Section',
      type: 'boolean',
      default: true,
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
