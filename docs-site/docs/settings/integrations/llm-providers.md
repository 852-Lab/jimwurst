---
sidebar_position: 2
title: LLM Providers
---

# LLM Providers

Ravioli supports local and cloud LLM execution to power the query synthesis, SQL generation, and AI cells.

---

## Ollama Local (Default)

Runs LLMs locally on your machine.
- **Connection**: Typically hosted at `http://localhost:11434` or routed to `host.docker.internal` inside Docker containers.
- **RAM Management**: Employs an unload method (`unload_model`) to purge active models from system RAM/VRAM after completing an analysis task.

---

## Ollama Cloud

Connects to external, cloud-hosted Ollama endpoints using secure API Bearer tokens.

---

## Google Gemini (Upcoming)

Google AI Studio integration is planned to support Gemini models. This will allow Ravioli to utilize Gemini's massive 2-million token context window to process massive directories and reference manuals.
