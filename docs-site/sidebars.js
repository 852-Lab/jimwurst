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
      label: 'Insights',
      link: {
        type: 'doc',
        id: 'insights',
      },
      collapsed: false,
      items: [
        'insights/feed-summary',
        'insights/lineage-map',
      ],
    },
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
          label: 'OLAP (DuckDB)',
          link: {
            type: 'doc',
            id: 'data/olap',
          },
          collapsed: false,
          items: [
            {
              type: 'category',
              label: 'Data Ingestion',
              link: {
                type: 'doc',
                id: 'data/olap/ingestion',
              },
              collapsed: false,
              items: [
                'data/olap/ingestion/flat-files',
                'data/olap/ingestion/api',
              ],
            },
            'data/olap/transformation',
          ],
        },
        'data/oltp',
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
            'settings/integrations/llm-providers',
            'settings/integrations/olap',
            {
              type: 'category',
              label: 'Documentation',
              link: {
                type: 'doc',
                id: 'settings/integrations/documentation',
              },
              collapsed: false,
              items: [
                'settings/integrations/notion-sync',
              ],
            },
          ],
        },
      ],
    },
  ],
};
