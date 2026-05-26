---
sidebar_position: 3
title: Insights
---

# Insights

**Insights** represent audited and verified facts extracted from your data analyses. Rather than sharing raw, unverified reports, Ravioli enforces a formal review lifecycle to extract verified facts and maintain the integrity of shared intelligence.

```mermaid
stateDiagram-v2
    Draft: Draft Insight (Unverified)
    Verified: Approved Insight (Verified)
    Published: Published Insight (Team Shared)
    
    [*] --> Draft : Analysis Approved
    Draft --> Verified : Steward/Admin Verification
    Verified --> Published : Marked is_published = True
```

---

## Insights Review Lifecycle

Ravioli ensures the quality and accuracy of shared intelligence by routing findings through a governance workflow:

1. **Draft State (Unverified)**: Created automatically when an analysis is approved, or manually drafted by an **[Editor](./governance/users.md#role-based-governance)**.
2. **Verification**: Reviewed by a **[Steward](./governance/users.md#role-based-governance)** or **[Admin](./governance/users.md#role-based-governance)** who inspects the markdown report and references the underlying raw data. Read more about this verification process in the **[Insights Review Guide](./governance/insights-review.md)**.
3. **Publishing**: Once verified, the insight is marked as `is_published = True` and displayed on team feeds, dashboard aggregates, and synced to third-party tools like Notion.

---

## Outcomes of Analyses

Insights are the structured results of your completed **[Analyses](./analyses.md)**. When a report is approved by an Admin or Steward, the backend runs a background task to extract individual bullet points, log audit lineages, and create dependencies.

Explore the modules:
1. **[Feed & Summary](./insights/feed-summary.md)**: Review published insights feed logs and high-level platform statistics.
2. **[Lineage Map](./insights/lineage-map.md)**: Explore the directed graph of insight dependencies showing how facts lead to business actions.
