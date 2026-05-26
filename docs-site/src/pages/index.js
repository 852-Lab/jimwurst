import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './index.module.css';

const CardList = [
  {
    title: 'Analyses & Insights',
    link: '/docs/analyses',
    emoji: '📊',
    description: 'Understand the core analyses model, the Kowalski AI analyst, and the human-in-the-loop verification workflow.',
  },
  {
    title: 'Quick Insights',
    link: '/docs/quick-insights',
    emoji: '⚡',
    description: 'Generate automatic statistical profiles, data cleaning reports, skewness alerts, and suggested query prompts.',
  },
  {
    title: 'Custom Notebooks',
    link: '/docs/custom-notebook',
    emoji: '📓',
    description: 'Explore data interactively using cell-based conversations, live execution tables, and in-place notebook cell updates.',
  },
  {
    title: 'Custom Deep Dives',
    link: '/docs/custom-deep-dives',
    emoji: '🧠',
    description: 'Engage the SQL agent for multi-step data exploration, self-correcting query loops, and dynamic visualization charts.',
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
