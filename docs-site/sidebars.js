/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

module.exports = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Analyses & Insights',
      link: {
        type: 'doc',
        id: 'analyses',
      },
      collapsed: false,
      items: [
        'quick-insights',
        'custom-notebook',
        'custom-deep-dives',
      ],
    },
    'data-ingestion',
    'duckdb-motherduck',
    'ai-integrations',
  ],
};
