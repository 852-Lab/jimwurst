import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './index.module.css';

const CardList = [
  {
    title: 'Getting Started',
    link: '/docs/intro',
    emoji: '🚀',
    description: 'Learn the core concepts of Ravioli and build your first local data warehouse in minutes.',
  },
  {
    title: 'Analyses',
    link: '/docs/analyses',
    emoji: '📊',
    description: 'Dive into cell-based notebooks, real-time SQL execution, and autonomous agent queries.',
  },
  {
    title: 'Insights',
    link: '/docs/insights',
    emoji: '⚡',
    description: 'Generate automated statistical profiles and govern verified insights published to the team.',
  },
  {
    title: 'Data',
    link: '/docs/data-assets',
    emoji: '💾',
    description: 'Ingest personal and corporate datasets, parse locations, and manage local DuckDB storage.',
  },
  {
    title: 'Knowledge Base',
    link: '/docs/knowledge',
    emoji: '📓',
    description: 'Ground LLMs in custom business domain knowledge and sync documents bi-directionally with Notion.',
  },
  {
    title: 'Integrations',
    link: '/docs/settings/integrations',
    emoji: '🔌',
    description: 'Connect local and cloud LLMs, link documentation engines like Notion/Confluence, and sync Motherduck warehouses.',
  },
];

function Card({ title, link, emoji, description }) {
  return (
    <div className="col col--6 margin-bottom--lg">
      <Link className={clsx('card', styles.docCard)} to={link}>
        <div className="card__body">
          <div className={styles.cardHeader}>
            <span className={styles.cardEmoji}>{emoji}</span>
            <h3 className={styles.cardTitle}>{title}</h3>
          </div>
          <p className={styles.cardDescription}>{description}</p>
          <div className={styles.cardLinkText}>
            Read docs &rarr;
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description={siteConfig.tagline}>

      <header className={styles.heroSection}>
        <div className="container text--center">
          <div className={styles.heroBadge}>Ravioli v0.1.0</div>
          <h1 className={styles.heroTitle}>
            Ravioli <span className={styles.heroHighlight}>Documentation</span>
          </h1>
          <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
          <div className={styles.searchPrompt}>
            Explore guides, references, and best practices to transform data elegantly.
          </div>
        </div>
      </header>

      <main className="container margin-vert--xl">
        <div className="row">
          {CardList.map((props, idx) => (
            <Card key={idx} {...props} />
          ))}
        </div>
      </main>
    </Layout>
  );
}
