---
title: app.analysis_logs
sidebar_label: analysis_logs
---

# `app.analysis_logs`

The `app.analysis_logs` table logs the granular, step-by-step thinking traces and tool execution observations of Ravioli's AI agents.

---

## Schema Field Definition

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` (Primary Key) | Unique identifier generated via `uuid.uuid4`. |
| `analysis_id` | `UUID` (Foreign Key, Required) | References the parent analysis report (`app.analyses.id`). |
| `log_type` | `VARCHAR(50)` (Required) | Category of execution step (e.g. `thought`, `tool_use`, `observation`, `error`). |
| `content` | `TEXT` (Required) | The log message or markdown description. |
| `tool_name` | `VARCHAR(255)` (Optional) | The name of the LangChain tool invoked (if `log_type = tool_use`). |
| `data` | `JSON` (Optional) | Holds structured inputs, outputs, or error traces. |
| `timestamp` | `TIMESTAMP` | Timestamp when the trace was logged. |

---

## Agent Step Auditing

By recording the agent's internal thought logs and tool responses sequentially, analysts can debug agent workflows, identify logic breakdowns, trace parsing exceptions, and audit query generation procedures.
