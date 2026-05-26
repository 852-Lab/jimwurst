---
title: app.users
sidebar_label: users
---

# `app.users`

:::info Business Definition Reference
For the functional roles, lineage attribution, and access levels associated with users, refer to the **[Users Business Definition](../../governance/users.md)**.
:::

The `app.users` table stores system user records, credentials, permission roles, and account statuses.

---

## Schema Field Definition

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` (Primary Key) | Unique identifier generated via `uuid.uuid4`. |
| `name` | `VARCHAR(255)` (Required) | The display name of the user. |
| `email` | `VARCHAR(255)` (Required, Unique) | User's login email address. |
| `hashed_password` | `VARCHAR(255)` (Optional) | Bcrypt hashed password (optional for SSO or token-based users). |
| `role` | `VARCHAR(50)` (Default: `Viewer`) | Access control roles: `Admin`, `Steward`, `Contributor`, `Viewer`. |
| `status` | `VARCHAR(50)` (Default: `active`) | Account status: `active`, `invited`. |
| `created_at` | `TIMESTAMP` | Record creation timestamp. |
| `updated_at` | `TIMESTAMP` | Record modification timestamp. |
| `created_by` | `UUID` (Foreign Key) | References the `app.users.id` who created the user. |
| `updated_by` | `UUID` (Foreign Key) | References the `app.users.id` who last updated the user. |

---

## Role-Based Access Control (RBAC)

The `role` field defines what actions the user is authorized to perform in the workspace:

*   **Admin**: Complete management access (configure system settings, invite users, override any data).
*   **Steward**: Governance focus (verify insights, manage data schemas, evaluate models).
*   **Contributor**: Active builder (run analyses, upload data sources, create custom notebooks).
*   **Viewer**: Read-only access (browse feeds, inspect lineage maps).
