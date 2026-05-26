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
    'insights',
    'knowledge',
    'data-assets',
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
        'settings/integrations',
      ],
    },
  ],
};
