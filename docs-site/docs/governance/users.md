---
sidebar_position: 2
title: Users
---

# Users

:::info Technical Database Schema
For the transactional database fields and schema structure, refer to the **[`app.users` Table Documentation](../data/oltp/users.md)**.
:::

Every activity in Ravioli—uploading an asset, defining a notebook query, or approving a draft report—is attributed to a specific **User**.

---

## Role-Based Governance

Ravioli implements a role-based access control (RBAC) model to align with data governance policies, particularly concerning the **[Insights Review & Verification Workflow](./insights-review.md)**:

- **Admin**: The central data team or platform administrators who take care of configuring and maintaining Ravioli for the organization.
- **Steward**: Data analysts or data-literate business domain experts who understand the business logic enough to review, audit, and approve draft insights.
- **Contributor**: Business users who have a basic level of analytical understanding (but may not be proficient in SQL or Python). They initiate analyses, upload files, and generate draft insights to be reviewed by Stewards.
- **Viewer**: Executives, business leaders, and stakeholders who only care about consuming high-level verified insights and taking actions.

### Role-Permissions Matrix

| Feature / Action | Viewer | Contributor | Steward | Admin |
| :--- | :---: | :---: | :---: | :---: |
| **View Dashboard / Lineage / Feeds** | ✅ | ✅ | ✅ | ✅ |
| **Run Queries / Write Custom Notebooks** | ❌ | ✅ | ✅ | ✅ |
| **Upload Raw Data / Flat Files** | ❌ | ✅ | ✅ | ✅ |
| **Initiate AI Analyses (Kowalski)** | ❌ | ✅ | ✅ | ✅ |
| **Review / Verify Draft Insights** | ❌ | ❌ | ✅ | ✅ |
| **Manage User / Groups Provisioning** | ❌ | ❌ | ❌ | ✅ |
| **Configure System-wide Settings & Keys** | ❌ | ❌ | ❌ | ✅ |

### Roles & Suggested Personas

| Role | Suggested Persona | Primary Mission & Access Scope |
| :--- | :--- | :--- |
| **Viewer** | Business Executives & Stakeholders | Consume high-level verified insights and actions from dashboards/feeds without drill-down or editing access. |
| **Contributor** | Business Users (basic analytical understanding, not proficient in SQL/Python) | Upload datasets, trigger AI analyses, and generate draft insights to be reviewed and published by Stewards. |
| **Steward** | Data Analysts & Business Domain Experts | Audit assumptions, verify calculations, and review & approve generated draft insights for team-wide publishing. |
| **Admin** | Central Data Team / Platform Administrator | Take care of Ravioli workspace administration, connect warehouses, provision groups/users, and manage system keys. |

---

## Lineage Attribution

Ravioli maintains strict data stewardship by logging ownership and attribution tags across all resources, including analyses and insights:
- **`created_by`**: The user ID who initiated the resource (e.g., uploaded the file, created the analysis).
- **`updated_by`**: The user ID who performed the most recent edit.
- **`owner_id`**: The individual user or group ID who owns the asset.
- **`owner_type`**: Reflects ownership level (e.g., `'user'` for individual ownership or `'group'` for shared team ownership via a **[User Group](./groups.md)**).
- **`verified_by_id` / `approved_by_id`**: (Specific to Insights) The user ID of the **Steward** or **Admin** who verified the draft insight.

This detailed audit log allows teams to trace data lineage from raw source files up to final published report pages, maintaining clear accountability for who owns and who approved every shared fact.
