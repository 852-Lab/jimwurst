---
sidebar_position: 3
title: Groups
---

# Groups

:::info Technical Database Schema
For the transactional database fields and schema structures, refer to the **[`app.user_groups` Table Documentation](../data/oltp/user-groups.md)** and the **[`app.user_group_members` Table Documentation](../data/oltp/user-group-members.md)**.
:::

To support collaborative and decentralized team management, Ravioli features **User Groups**. Groups act as collective owners of data assets, analyses, and knowledge entries.

---

## Collective Ownership

When files or analyses are created, ownership can be assigned to a group:
- **Shared Access**: Members of a group inherit permissions to view, run, and update the group's assets.
- **`owner_type = 'group'`**: Identifies that a collective entity owns the resource, switching access controls from individual checks to group membership lookups.

---

## Group Management

- **Membership**: Managed via the secondary link table `app.user_group_members`.
- **Ownership**: Groups themselves have an `owner_id` (the user who created the group) and auditing tags (`created_by`, `updated_by`) to ensure governance at the organizational level.
