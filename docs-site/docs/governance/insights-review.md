---
sidebar_position: 1
title: Insights Review
---

# Insights Review

:::info Technical Database Schema
For the transactional database fields and schema structures, refer to the **[`app.insights` Table Documentation](../data/oltp/insights.md)**.
:::

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

---

## Insight Ownership & Approval Attribution

To ensure accountability and trace origin lines, every insight in Ravioli records clear ownership and approval attributes:

### 1. Who Owns the Insight?
* **Asset Owner**: The `owner_id` of the insight matches the owner of the source analysis. 
* **Ownership Type (`owner_type`)**:
  * **Individual Ownership (`'user'`)**: The individual analyst or Editor who authored the notebook/analysis owns the resulting insight.
  * **Collective Ownership (`'group'`)**: When an analysis is created on behalf of a team (e.g., "Marketing Analytics Group"), the ownership is assigned to that **[User Group](./groups.md)**, allowing all group members to view or edit.

### 2. Who Reviews & Approves the Insight?
* **The Reviewer/Verifier**: Only **[Stewards](./users.md#role-based-governance)** and **[Admins](./users.md#role-based-governance)** are permitted to review draft insights.
* **Audit Metadata**: Upon verification, the database logs the exact user ID of the verifying Steward or Admin in the `verified_by_id` (or `approved_by_id`) field.
* **Separation of Duties**: Even if an Admin or Steward is the author/owner of an analysis, best-practice workflows encourage a different Steward to perform the verification to maintain objective, peer-reviewed accuracy.
