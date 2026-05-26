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
      label: 'Analyses',
      link: {
        type: 'doc',
        id: 'analyses',
      },
      collapsed: false,
      items: [
        'analyses/quick-insights',
        'analyses/custom-notebooks',
        'analyses/deep-dives',
      ],
    },
    'insights',
    'knowledge',
    {
      type: 'category',
      label: 'Data',
      link: {
        type: 'doc',
        id: 'data',
      },
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Data Ingestion',
          collapsed: false,
          items: [
            'data/flat-files',
            'data/api',
          ],
        },
        'data/dlt-ingestion',
        'data/transformation',
      ],
    },
    {
      type: 'category',
      label: 'Governance',
      collapsed: false,
      items: [
        'governance/insights-review',
        'governance/users',
        'governance/groups',
      ],
    },
    {
      type: 'category',
      label: 'Settings',
      collapsed: false,
      items: [
        'settings/basic-settings',
        {
          type: 'category',
          label: 'Integrations',
          link: {
            type: 'doc',
            id: 'settings/integrations',
          },
          collapsed: false,
          items: [
            'settings/notion-sync',
          ],
        },
      ],
    },
  ],
};
