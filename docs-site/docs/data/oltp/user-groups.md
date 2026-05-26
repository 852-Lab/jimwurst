---
title: app.user_groups
sidebar_label: user_groups
---

# `app.user_groups`

The `app.user_groups` table defines active workspaces or teams within Ravioli, enabling collaborative sharing and asset ownership.

---

## Schema Field Definition

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` (Primary Key) | Unique identifier generated via `uuid.uuid4`. |
| `name` | `VARCHAR(255)` (Required) | The display name of the group. |
| `description` | `TEXT` (Optional) | Detailed summary of the group's purpose. |
| `owner_id` | `UUID` (Foreign Key) | References the `app.users.id` who owns/leads the group (typically a Steward). |
| `created_at` | `TIMESTAMP` | Group creation timestamp. |
| `created_by` | `UUID` (Foreign Key) | References the `app.users.id` who created the group. |
| `updated_by` | `UUID` (Foreign Key) | References the `app.users.id` who last updated the group. |

---

## Workspace Collaboration

Groups serve as polymorphic owners (`owner_type = 'group'`) for analytical assets like **Analyses**, **Data Sources**, and **Insights**. Group membership details are stored in the association table `app.user_group_members`.
