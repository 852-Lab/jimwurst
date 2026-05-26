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

- **Admin**: Oversees the entire analytical ecosystem, manages database resources, connects data warehouses, and holds universal approval privileges. Can verify any draft insights.
- **Steward**: Subject matter experts embedded in business units (e.g., Marketing, Finance). Stewards are responsible for reviewing functional analyses and auditing/verifying draft facts before they are published. See [Insights Review](./insights-review.md) for details.
- **Contributor**: Analysts and developers who write notebooks, run queries, initiate analyses, and draft insights. Contributors cannot self-approve; their draft insights must be verified by a Steward or Admin.
- **Viewer**: Read-only access to published insights, dashboards, and lineage maps.

### Role-Permissions Matrix

| Feature / Action | Admin | Steward | Contributor | Viewer |
| :--- | :---: | :---: | :---: | :---: |
| **View Dashboard / Lineage / Feeds** | ✅ | ✅ | ✅ | ✅ |
| **Run Queries / Write Custom Notebooks** | ✅ | ✅ | ✅ | ❌ |
| **Upload Raw Data / Flat Files** | ✅ | ✅ | ✅ | ❌ |
| **Initiate AI Analyses (Kowalski)** | ✅ | ✅ | ✅ | ❌ |
| **Review / Verify Draft Insights** | ✅ | ✅ | ❌ | ❌ |
| **Manage User / Groups Provisioning** | ✅ | ❌ | ❌ | ❌ |
| **Configure System-wide Settings & Keys** | ✅ | ❌ | ❌ | ❌ |

### Roles & Suggested Personas

| Role | Suggested Persona | Primary Mission & Access Scope |
| :--- | :--- | :--- |
| **Admin** | Central Data Team Lead, Analytics Engineering Lead, System Administrator | Infrastructure management, data connection configurations, API keys setups, group creation, and universal review access. |
| **Steward** | Functional Lead, Analytics Literate Domain Expert, Product Lead | Quality control, business logic auditing, fact verification, and reviewing drafts to publish insights for the wider team. |
| **Contributor** | Analytics Engineer, Data Analyst, Software Engineer, Active Creator | Query building, data exploration via notebooks, raw data uploads, and drafting insights (require Steward approval to publish). |
| **Viewer** | Business Executive, Operational Stakeholder, General Team Member | Data consumption, viewing published feeds/lineage maps, and referencing verified facts to make data-driven decisions. |

---

## Lineage Attribution

Ravioli maintains strict data stewardship by logging ownership and attribution tags across all resources, including analyses and insights:
- **`created_by`**: The user ID who initiated the resource (e.g., uploaded the file, created the analysis).
- **`updated_by`**: The user ID who performed the most recent edit.
- **`owner_id`**: The individual user or group ID who owns the asset.
- **`owner_type`**: Reflects ownership level (e.g., `'user'` for individual ownership or `'group'` for shared team ownership via a **[User Group](./groups.md)**).
- **`verified_by_id` / `approved_by_id`**: (Specific to Insights) The user ID of the **Steward** or **Admin** who verified the draft insight.

This detailed audit log allows teams to trace data lineage from raw source files up to final published report pages, maintaining clear accountability for who owns and who approved every shared fact.
