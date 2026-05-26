---
sidebar_position: 1
title: Ollama
---

# Ollama Setup

Ravioli integrates natively with Ollama to provide both local and cloud-hosted LLM execution.

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
- **API Bearer Tokens**: You can point the Ollama connection to a cloud endpoint (such as a shared Kubernetes cluster or cloud GPU service) and configure a bearer token. For official details on obtaining your API key, check your account settings on [ollama.com](https://ollama.com) or refer to the [Ollama Blog](https://ollama.com/blog/security-keys) / [GitHub repository](https://github.com/ollama/ollama) documentation.
- **Header Injection**: The backend client automatically injects the decrypted `Authorization: Bearer <token>` header into outbound requests at runtime.
- **Security & Encryption**: Like all credentials in Ravioli, the API key is secured using symmetric **AES-256-GCM** encryption at rest in the transactional database and redacted as `••••••••` in frontend API responses. For details, see the [Security & Credential Storage](../../integrations.md#security--credential-storage) documentation.


