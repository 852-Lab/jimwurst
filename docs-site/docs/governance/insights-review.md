---
sidebar_position: 1
title: Insights Review
---

# Insights Review

The **Insights Review** workflow ensures that AI-generated conclusions are audited by human stakeholders before they are made official or published to the team.

---

## Roles in Review

Governance in Ravioli relies on two primary roles (defined in detail in the **[User Profiles & Roles](./users.md#role-based-governance)** section):
1. **[Admins](./users.md#role-based-governance) (Central Data Team)**: Oversee the analytical ecosystem, manage database resources, connect new data warehouses, and verify system-wide compliance.
2. **[Stewards](./users.md#role-based-governance) (Embedded Teams)**: Subject matter experts embedded in specific business functions (e.g., Marketing, Operations). They review functional analyses, verify that assumptions align with operational realities, and approve draft insights.

---

## Approval Workflow

When the AI analyst Kowalski completes an analysis report:
1. **Draft State**: The report is generated in markdown and remains unapproved. The analysis metadata reflects `is_approved = false`.
2. **Review**: Admins or Stewards inspect the markdown, verifying the findings against the attached data sources and assumptions.
3. **Approval Trigger**: Clicking **Approve** triggers a background extraction task:
   - The markdown is parsed by the LLM into individual, structured key insights.
   - Separate `Insight` records are created in the database.
   - Insights inherit the owner, creator, and reviewer metadata from the analysis.
4. **Publishing**: Verified insights (`is_verified = true`) can be marked as published (`is_published = true`), making them visible on team dashboards and eligible to sync to Notion.
