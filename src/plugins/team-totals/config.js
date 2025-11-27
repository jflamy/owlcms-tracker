export default {
  name: 'Team Totals',
  description: 'Aggregates V2 athlete results and ranks teams by the sum of their top performers.',
  options: [
    {
      key: 'topN',
      label: 'Top Athletes Per Team',
      type: 'number',
      min: 1,
      max: 6,
      step: 1,
      default: 3,
      description: 'How many athletes per team contribute to the total.'
    },
    {
      key: 'gender',
      label: 'Gender Filter',
      type: 'select',
      options: ['MF', 'M', 'F'],
      default: 'MF',
      description: 'Limit the ranking to male, female, or combined athletes.'
    },
    {
      key: 'scoreMetric',
      label: 'Score Metric',
      type: 'select',
      options: ['total', 'sinclair'],
      default: 'total',
      description: 'Choose whether the team score uses totals (kg) or Sinclair points.'
    }
  ]
};
