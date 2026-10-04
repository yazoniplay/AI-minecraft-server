# AI orchestration

The package contains a model-provider interface, an OpenAI-compatible chat-completions provider with function calling, and a multi-step agent loop.

## Provider configuration

Construct `OpenAICompatibleProvider` with:
- `apiKey` — provider API key, never commit this
- `baseUrl` — optional OpenAI-compatible API base URL
- `model` — model name

The provider converts the project’s simple tool input descriptors into JSON Schema and normalizes returned function calls.

## Execution safeguards

`ServerAgent` requires a `ToolContext`. Read-only tools can run without approval. Mutating tools are not executed in dry-run mode and require `approved: true` in the execution context. Callers must only set that flag after an explicit user approval flow.

## Integration status

This package is not yet wired into the web dashboard or a remote agent transport. It is a reusable orchestration layer, not a claim that the hosted UI already controls a server.
