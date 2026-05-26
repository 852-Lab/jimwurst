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
- **Role**: Determines access level (e.g., `Admin`, `Viewer`, `Editor`, `Steward`).
- **Status**: Account state (e.g., `active`, `suspended`).

---

## Lineage Attribution

Ravioli maintains strict data stewardship by logging ownership and attribution tags:
- **`created_by`**: The user ID who initiated the resource (e.g., uploaded the file, created the analysis).
- **`updated_by`**: The user ID who performed the most recent edit.
- **`owner_id`**: The individual user ID who owns the asset.
- **`owner_type`**: Reflects ownership level (e.g., `'user'` for individual ownership or `'group'` for shared team ownership).

This detailed log allows teams to trace data lineage from raw CSV files up to final published report pages.
