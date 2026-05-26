---
title: app.user_group_members
sidebar_label: user_group_members
---

# `app.user_group_members`

:::info Business Definition Reference
For membership roles and collaborative settings associated with user groups, refer to the **[Groups Business Definition](../../governance/groups.md)**.
:::

The `app.user_group_members` table is an association (join) table representing a many-to-many relationship between system **Users** and **User Groups**.

---

## Schema Field Definition

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `user_id` | `UUID` (Composite Primary Key, Foreign Key) | References the member user's `app.users.id`. |
| `group_id` | `UUID` (Composite Primary Key, Foreign Key) | References the group's `app.user_groups.id`. |
| `role_in_group` | `VARCHAR(50)` (Optional) | User role within the team (e.g. `Lead`, `Member`). |
| `joined_at` | `TIMESTAMP` | Timestamp when the user joined the group. |
| `updated_at` | `TIMESTAMP` | Timestamp of the last membership change. |
| `updated_by` | `UUID` (Foreign Key) | References the `app.users.id` who modified this membership. |

---

## Relationships Model

This join model permits users to belong to multiple group workspaces, inheriting the collective dataset and report accesses defined for those environments.
