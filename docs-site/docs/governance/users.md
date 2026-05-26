---
sidebar_position: 2
title: Users
---

# Users

Every activity in Ravioli—uploading an asset, defining a notebook query, or approving a draft report—is attributed to a specific **User**.

---

## User Metadata

User profiles contain standard identifiers managed in PostgreSQL:
- **Identifier**: A unique UUID.
- **Name**: Display name (e.g., "Jimmy Pang").
- **Email**: Corporate email address.
- **Role**: Determines access level (e.g., `Admin`, `Viewer`, `Editor`, `Steward`). See [Role-Based Governance](#role-based-governance) for details on their permissions.
- **Status**: Account state (e.g., `active`, `suspended`).

---

## Role-Based Governance

Ravioli implements a role-based access control (RBAC) model to align with data governance policies, particularly concerning the **[Insights Review & Verification Workflow](./insights-review.md)**:

- **Admin**: Oversees the entire analytical ecosystem, manages database resources, connects data warehouses, and holds universal approval privileges. Can verify any draft insights.
- **Steward**: Subject matter experts embedded in business units (e.g., Marketing, Finance). Stewards are responsible for reviewing functional analyses and auditing/verifying draft facts before they are published. See [Insights Review](./insights-review.md) for details.
- **Editor**: Analysts and developers who write notebooks, run queries, initiate analyses, and draft insights. Editors cannot self-approve; their draft insights must be verified by a Steward or Admin.
- **Viewer**: Read-only access to published insights, dashboards, and lineage maps.

---

## Lineage Attribution

Ravioli maintains strict data stewardship by logging ownership and attribution tags:
- **`created_by`**: The user ID who initiated the resource (e.g., uploaded the file, created the analysis).
- **`updated_by`**: The user ID who performed the most recent edit.
- **`owner_id`**: The individual user ID who owns the asset.
- **`owner_type`**: Reflects ownership level (e.g., `'user'` for individual ownership or `'group'` for shared team ownership).

This detailed log allows teams to trace data lineage from raw CSV files up to final published report pages.
