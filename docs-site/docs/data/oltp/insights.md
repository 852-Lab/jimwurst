---
title: app.insights
sidebar_label: insights
---

# `app.insights`

The `app.insights` table tracks individual, granular bullet-point facts derived from approved agent analyses and reports.

---

## Schema Field Definition

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` (Primary Key) | Unique identifier generated via `uuid.uuid4`. |
| `analysis_id` | `UUID` (Foreign Key, Required) | References the parent analysis report (`app.analyses.id`). |
| `content` | `TEXT` (Required) | The natural language fact or finding. |
| `source_label` | `VARCHAR(255)` (Optional) | User-facing origin description (e.g. `Quick Insight: spotify_streams_2026.csv`). |
| `assumptions` | `TEXT` (Optional) | Any baseline parameters or context flags used in query reasoning. |
| `limitations` | `TEXT` (Optional) | Constraints (e.g., date ranges or missing categories). |
| `insight_metadata` | `JSON` (Optional) | Metadata payload tracking validation rules or custom tags. |
| `is_verified` | `BOOLEAN` (Default: `False`) | Verified status flag (requires Steward or Admin confirmation). |
| `is_published` | `BOOLEAN` (Default: `False`) | Controls if the insight is displayed on the main platform feed. |
| `created_at` | `TIMESTAMP` | Timestamp when the insight was distilled. |
| `updated_at` | `TIMESTAMP` | Last updated timestamp. |
| `owner` | `UUID` (Foreign Key) | References the `app.user_groups.id` owning the insight. |
| `created_by` | `UUID` (Foreign Key) | References the `app.users.id` who distilled the insight. |
| `updated_by` | `UUID` (Foreign Key) | References the `app.users.id` who modified the metadata. |
| `reviewed_by` | `UUID` (Foreign Key) | References the `app.users.id` (Steward/Admin) who verified/published the fact. |
| `owner_id` | `UUID` (Optional) | Polymorphic owner ID link. |
| `owner_type` | `VARCHAR(50)` (Optional) | Polymorphic owner type (`user` or `group`). |

---

## Governance Workflow

1.  **Draft**: Ingested/analyzed insights start as unverified (`is_verified = False`) drafts.
2.  **Steward Review**: A Steward logs in, reviews assumptions and limits, and toggles `is_verified` to `True`.
3.  **Publish**: When `is_published` is set `True`, the fact feeds onto the shared platform dashboard.
