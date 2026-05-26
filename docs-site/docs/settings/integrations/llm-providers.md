---
sidebar_position: 2
title: LLM Providers
---

# LLM Providers

Ravioli supports local, private, and cloud-hosted Large Language Models (LLMs) to drive query synthesis, schema inference, SQL code generation, and interactive AI notebook execution.

---

## Ollama Local (Default)

By default, Ravioli is configured to connect to a local **Ollama** server running on the user's host machine.

### Connection & Routing
- **Default Endpoint**: `http://localhost:11434` (for standalone local application builds) or `http://host.docker.internal:11434` (for containerized deployments to let the Docker network route back to the host machine).
- **Default Model**: `gemma3:4b` (a balanced model optimal for latency, SQL synthesis, and JSON generation).

### RAM / VRAM Management & Purging
Local machine memory is highly constrained. Running large models on consumer hardware alongside Docker and local database engines can lead to Out-Of-Memory (OOM) crashes.

To mitigate this, the backend Ollama client implements active RAM recovery:
- **`unload_model` Call**: When an AI cell execution or analysis task finishes, Ravioli invokes the Ollama `/api/generate` or `/api/chat` endpoint with `keep_alive` set to `0`.
- This tells the Ollama runtime to immediately purge the model from CPU RAM or GPU VRAM, returning system memory back to the operating system instead of keeping the model cached in memory.

---

## Ollama Cloud

For teams that prefer offloading inference to dedicated remote machines:
- **API Bearer Tokens**: You can point the Ollama connection to a cloud endpoint (such as a shared Kubernetes cluster or cloud GPU service) and configure a bearer token.
- **Header Injection**: The backend client automatically injects the encrypted `Authorization: Bearer <token>` header into all outbound requests.

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
