---
sidebar_position: 2
title: LLM Providers
---

# LLM Providers

Ravioli supports local, private, and cloud-hosted Large Language Models (LLMs) to drive query synthesis, schema inference, SQL code generation, and interactive AI notebook execution.

:::tip Privacy & Cost Efficiency
By default, Ravioli prioritizes local execution via **Ollama (Local)** to ensure absolute data privacy and zero inference costs. However, in many corporate environments where local hardware limitations or strict context size needs override these concerns, Ravioli offers native integrations with cloud-hosted alternatives like **Ollama Cloud** and upcoming integrations with **Google Gemini**.

*Please be aware of the trade-off: by adding integration with Ollama Cloud or Google Gemini, it essentially means the information and queried data will be sent over to the providers' servers for processing.*
:::

---

## Ollama (Default Local & Cloud)

Ravioli supports local execution and cloud-hosted setups for Ollama. 

* **Setup & Configuration**: See the detailed **[Ollama Setup Guide](./llm-providers/ollama.md)** for connection details, routing configurations, and RAM/VRAM resource saving mechanisms.

---

## Google Gemini (Upcoming)

Ravioli plans native integration with Google Gemini via **Google AI Studio**:
- **Massive Context Windows**: Allows teams to utilize Gemini 1.5 Pro and Flash with context windows up to 2 million tokens.
- **Directory and Code Analysis**: This context window is big enough to feed complete database schemas, metadata tables, and entire directories of Notion knowledge bases into a single prompt.
- **Setup**: Users will paste their Google AI Studio API key into the Settings menu, which will be encrypted and saved under the `gemini` settings key.

---

## Configuration Schema

The settings database stores LLM configurations under the `ollama` system setting key.

### JSON Payload Schema
```json
{
  "mode": "custom", 
  "base_url": "http://host.docker.internal:11434",
  "default_model": "gemma3:8b",
  "api_key": "••••••••"
}
```

### Connection Testing
You can verify the connection status directly in the UI using the **Test Connection** button, which calls the endpoint:
`GET /api/v1/settings/ollama/test`

This endpoint runs a connection handshake with the target Ollama node to verify accessibility and list all loaded/available models on that Ollama service.
