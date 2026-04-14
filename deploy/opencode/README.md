# OpenCode Deployment

Browser-accessible [OpenCode](https://github.com/opencode-ai/opencode) AI coding agent with web terminal (ttyd).

> **Note:** OpenCode has been archived and continues as [Crush](https://github.com/charmbracelet/crush) by Charmbracelet. This deployment supports both OpenCode and Crush.

## Features

- **OpenCode** (latest) — terminal-based AI coding agent
- **Multi-provider support** — OpenAI, Anthropic, Google Gemini, Groq, Azure, OpenRouter
- **Web Terminal** via ttyd for browser access
- **LSP integration** — code intelligence in the terminal
- **Session management** — persistent SQLite-based conversations
- **TLS** via cert-manager (Kubernetes) or OpenShift Router

## Prerequisites

### Required
1. Kubernetes cluster with nginx ingress controller, **OR** OpenShift 4.x
2. API key for at least one LLM provider (OpenAI, Anthropic, Gemini, etc.)

### Kubernetes
- cert-manager with a cluster issuer (e.g., `letsencrypt-issuer`)

### OpenShift
- OpenShift Router configured

## Quick Start

### 1. Deploy to Kubernetes

```bash
# Apply the deployment
kubectl apply -f deployment.yaml

# Create secret with your API key(s)
kubectl create secret generic opencode-api-keys \
  --from-literal=anthropic-key=sk-ant-YOUR_KEY \
  --from-literal=openai-key=sk-YOUR_KEY \
  -n opencode
```

### 2. Or Deploy to OpenShift

```bash
# Apply the deployment
oc apply -f deployment-openshift.yaml

# Create secret with your API key(s)
oc create secret generic opencode-api-keys \
  --from-literal=anthropic-key=sk-ant-YOUR_KEY \
  -n opencode
```

### 3. Customize for Your Environment

Edit `deployment.yaml` and update:

```yaml
# In ConfigMap
data:
  HOSTNAME: "opencode.your-domain.com"
  LLM_PROVIDER: "anthropic"  # openai, anthropic, gemini, groq, azure, openrouter

# In Ingress/Route
spec:
  rules:
  - host: opencode.your-domain.com
```

### 4. Access the Web Terminal

1. Point your DNS to the ingress IP
2. Open: `https://opencode.your-domain.com`
3. Start coding: `opencode` in the terminal

## Configuration

### Supported LLM Providers

| Provider | Environment Variable | Config Value |
|----------|---------------------|--------------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic` |
| OpenAI | `OPENAI_API_KEY` | `openai` |
| Google Gemini | `GEMINI_API_KEY` | `gemini` |
| Groq | `GROQ_API_KEY` | `groq` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | `azure` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter` |

### Local Configuration

OpenCode looks for `.opencode.json` in the working directory:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "autoCompact": true
}
```

### Resource Requirements

| Resource | Request | Limit |
|----------|---------|-------|
| Memory | 256Mi | 1Gi |
| CPU | 200m | 1000m |

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          Ingress / Route            │
                    │   opencode.your-domain.com (TLS)    │
                    └──────────────┬──────────────────────┘
                                   │ :443
                                   ▼
                    ┌─────────────────────────────────────┐
                    │           Service                   │
                    │        opencode:7681                │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                           Pod                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                        ttyd :7681                            │ │
│  │                    (Web Terminal Server)                     │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             │ /bin/bash                           │
│  ┌──────────────────────────┴──────────────────────────────────┐ │
│  │                    OpenCode Agent                            │ │
│  │  - opencode (AI coding agent, Go binary)                    │ │
│  │  - git, go, nodejs                                          │ │
│  │  - LSP support for code intelligence                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Secrets: opencode-api-keys (API keys)                           │
│  ConfigMap: opencode-config (provider, model, hostname)          │
│  PVC: opencode-sessions (persistent session storage)             │
└───────────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Check Pod Logs

```bash
kubectl logs -f deployment/opencode -n opencode
```

### Check OpenCode Version

```bash
kubectl exec deployment/opencode -n opencode -- opencode version
```

### "API key not configured"

Ensure the secret has the correct key for your provider:

```bash
kubectl describe secret opencode-api-keys -n opencode
```

### Pod CrashLoopBackOff

OpenCode requires a valid API key to start. Check:

```bash
kubectl logs deployment/opencode -n opencode --previous
```

### Restart Pod

```bash
kubectl rollout restart deployment/opencode -n opencode
```

## Security Notes

- The web terminal provides full shell access — protect with network policies
- API keys stored in Kubernetes secrets with appropriate RBAC
- Consider adding authentication layer (OAuth, SSO) for production use
- WebSocket support required for ttyd web terminal
- PVC for session data — consider encryption at rest

## Related

- `kustomization.yaml` — Kustomize configuration
- https://github.com/opencode-ai/opencode — OpenCode repository
- https://github.com/charmbracelet/crush — Crush (OpenCode successor)
