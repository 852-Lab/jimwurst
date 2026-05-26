---
sidebar_position: 2
title: Google Gemini
---

# Google Gemini (Upcoming)

Ravioli plans native integration with Google Gemini via **Google AI Studio** to support cloud-scale analysis.

---

## Capabilities

- **Massive Context Windows**: Enables teams to utilize Gemini 1.5 Pro and Gemini 1.5 Flash, offering context windows up to 2 million tokens.
- **Directory and Code Analysis**: This massive context window makes it possible to feed complete database schemas, OLTP metadata tables, and entire directories of Notion knowledge bases into a single prompt for comprehensive analytical answers.
- **Security & Encryption**: Like all credentials in Ravioli, your Google AI Studio API key will be secured using symmetric **AES-256-GCM** encryption at rest in the transactional database and redacted as `••••••••` in frontend API responses. For details, see the [Security & Credential Storage](../../integrations.md#security--credential-storage) documentation.

---

## Setup

When launched, configuring Google Gemini will involve:
1. Generating an API key from Google AI Studio.
2. Saving it under the `gemini` settings key in the platform Settings menu.
