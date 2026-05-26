---
sidebar_position: 1
title: Feed & Summary
---

# Executive Feed & Summary

The **Insights Feed & Summary** acts as the primary landing page for executives, department heads, and business leaders. It aggregates all audited, verified findings across the organization into a single, high-level intelligence briefing—filtering out raw query noise to present only verified, actionable facts.

---

## Executive Value Proposition

Ravioli provides leaders with a **Single Source of Truth (SSOT)**:
* **Zero-Noise Intelligence**: Leaders only see insights that have been vetted by domain experts (Stewards/Admins). There are no unverified drafts or incomplete calculations in this feed.
* **Audit Trail**: Every card shows who produced the insight, who verified it, and which data models it relies on.
* **Seamless Syndication**: Promising insights can be synced directly to Notion workspaces or executive slide decks.

---

## Platform Summary Metrics (`/stats`)

For leadership, the dashboard provides a bird's-eye view of organizational intelligence throughput and data governance health:

* **Insight Volume & Velocity**: Track the total number of verified insights generated over time to measure analytics productivity.
* **Governance Status**: View the ratio of draft insights vs. verified insights. This metrics dashboard helps leaders ensure that verification queues (managed by Stewards) are not bottlenecked.
* **Asset Distribution**: High-level break-down of which business units (Marketing, Operations, Finance) are publishing findings.

---

## The Collaborative Feed (`/feed`)

The feed is designed for quick scanning and high-level decision making:

* **Executive Briefing Cards**: Summarized sentences written in plain English, paired with visual markers showing confidence levels and source systems.
* **Attribution Cards**: Shows both the creator (e.g., "Created by AI Analyst Kowalski") and the peer-reviewer (e.g., "Verified by Jimmy Pang, Steward").
* **Strategic Filters**: Quickly isolate insights by department, date range, or business impact tag.
* **Drill-down Capability**: For leaders who want to inspect the details, each card provides a secure click-through to the originating **[Notebook](../analyses.md)** and the **[Data Lineage Map](../insights/lineage-map.md)**.

---

## Technical Integration

For developers building custom dashboard integrations or alerts for leadership:

### API Endpoints
* **`GET /api/v1/insights/feed?days=30`**: Returns a chronological list of insights published over the selected duration (defaults to 30 days) along with verification tags, author, and reviewer IDs.
* **`GET /api/v1/insights/stats`**: Serves aggregates for dashboard graphs (e.g., total active draft counts, cumulative verified count, and active contributor counts).
