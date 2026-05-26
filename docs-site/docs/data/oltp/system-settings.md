---
title: app.system_settings
sidebar_label: system_settings
---

# `app.system_settings`

The `app.system_settings` table acts as a transactional key-value store for app-wide settings, access keys, and external service credentials.

---

## Schema Field Definition

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `key` | `VARCHAR(100)` (Primary Key) | The setting identifier (e.g. `motherduck`, `notion`, `llm_keys`). |
| `value` | `JSON` (Required) | The configuration payload matching the setting schema. |
| `updated_at` | `TIMESTAMP` | Timestamp of the last setting update. |
| `owner` | `UUID` (Foreign Key) | References the `app.user_groups.id` managing the configuration. |
| `created_by` | `UUID` (Foreign Key) | References the `app.users.id` who configured the settings. |
| `updated_by` | `UUID` (Foreign Key) | References the `app.users.id` who updated the settings. |

---

## Encryption & Security

Sensitive credentials, such as Ollama keys, Notion API integrations, and MotherDuck cloud credentials, are saved inside encrypted strings inside the `value` JSON dictionary (decrypted dynamically at runtime by Ravioli's backend service).
