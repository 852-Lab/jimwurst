---
title: app.knowledge_pages
sidebar_label: knowledge_pages
---

# `app.knowledge_pages`

:::info Business Definition Reference
For details on Notion integration syncing, page metadata properties, and AI context grounding, refer to the **[Knowledge Base Business Definition](../../knowledge.md)**.
:::

The `app.knowledge_pages` table stores Notion-compatible block lists representing domain definitions, guidelines, and context pages to ground AI analyses.

---

## Schema Field Definition

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` (Primary Key) | Unique identifier generated via `uuid.uuid4`. |
| `properties` | `JSON` (Default: `{}`) | Key-value properties representing fields (Notion page schemas). |
| `title` | `VARCHAR(255)` (Required) | The title or name of the knowledge page. |
| `icon` | `JSON` (Optional) | Emoji or icon attributes (e.g. `{"type": "emoji", "emoji": "📓"}`). |
| `cover` | `JSON` (Optional) | Cover image properties (e.g. external image URLs). |
| `content` | `JSON` (Optional) | Notion-style list of nested block objects containing text/elements. |
| `source` | `VARCHAR(50)` (Default: `manual`) | Page origin identifier: `manual`, `notion`. |
| `source_id` | `VARCHAR(255)` (Optional) | External identifier reference (e.g., a remote Notion Page ID). |
| `owner` | `UUID` (Foreign Key) | References the `app.user_groups.id` owning this page. |
| `created_by` | `UUID` (Foreign Key) | References the `app.users.id` who created the page. |
| `updated_by` | `UUID` (Foreign Key) | References the `app.users.id` who modified the page. |
| `reviewed_by` | `UUID` (Foreign Key) | References the `app.users.id` who verified page context. |
| `owner_type` | `VARCHAR(50)` (Default: `user`) | Polymorphic owner type (`user` or `group`). |
| `owner_id` | `VARCHAR(255)` (Optional) | Polymorphic ID link. |
| `ownership_type` | `VARCHAR(50)` (Default: `individual`) | Scope categorizations: `individual`, `team`. |
| `parent_id` | `UUID` (Foreign Key) | References the parent knowledge page, enabling page hierarchies. |
| `created_at` | `TIMESTAMP` | Page creation timestamp. |
| `updated_at` | `TIMESTAMP` | Last updated timestamp. |

---

## Notion Integration Compatibility

The `content` field stores block lists formatted as JSON elements (e.g., paragraphs, lists, callouts, headers). This structure replicates Notion's page structures, allowing Ravioli to sync pages bi-directionally via Notion's API without losing formatting layout.
