# AI Agent Deployment Template

Use this template to deploy any AI-powered CLI tool to Kubernetes/OpenShift with web terminal access.

## Directory Structure

```
deploy/ai-agent-template/
├── README.md              # This file
├── deployment.yaml        # Kubernetes deployment with Ingress
├── deployment-openshift.yaml  # OpenShift deployment with Route
├── kustomization.yaml     # Kustomize configuration
└── scripts/
    └── install.sh         # Installation script template
```

## Required Components

Every AI agent deployment should include:

1. **ConfigMap** - Non-sensitive configuration
2. **Secret** - API keys and tokens
3. **Deployment** - Container with ttyd for web access
4. **Service** - ClusterIP on port 7681 (ttyd)
5. **Ingress/Route** - External access with TLS

## Template Variables

When creating a new AI agent deployment, replace these placeholders:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{AGENT_NAME}}` | Agent name (lowercase, hyphens) | `github-copilot-cli` |
| `{{AGENT_DISPLAY}}` | Display name | `GitHub Copilot CLI` |
| `{{AGENT_IMAGE}}` | Container image | `alpine:3.19` |
| `{{AGENT_NAMESPACE}}` | Kubernetes namespace | `ai-agents` |
| `{{AGENT_HOST}}` | Public hostname | `agent.example.com` |
| `{{SECRET_NAME}}` | Secret containing API key | `github-copilot-token` |
| `{{SECRET_KEY}}` | Key in secret | `token` |
| `{{INSTALL_SCRIPT}}` | Installation commands | See below |

## Quick Start

### 1. Copy Template

```bash
cp -r deploy/ai-agent-template deploy/your-agent-name
cd deploy/your-agent-name
```

### 2. Replace Variables

```bash
sed -i 's/{{AGENT_NAME}}/your-agent-name/g' *.yaml
sed -i 's/{{AGENT_DISPLAY}}/Your Agent Name/g' *.yaml
sed -i 's/{{AGENT_HOST}}/agent.example.com/g' *.yaml
```

### 3. Create Secret

```bash
kubectl create secret generic your-agent-token \
  --from-literal=token=YOUR_API_KEY \
  -n ai-agents
```

### 4. Deploy

```bash
kubectl apply -f deployment.yaml
```

## Installation Script Template

Place in `scripts/install.sh`:

```bash
#!/bin/sh
set -e

# Install dependencies
apk add --no-cache git curl bash nodejs npm ttyd

# Install your AI agent CLI
# Example for npm packages:
npm install -g your-ai-agent-cli

# Configure authentication if token is available
if [ -n "$AGENT_TOKEN" ]; then
    echo "Configuring ${AGENT_NAME}..."
    your-ai-agent-cli auth login --token "$AGENT_TOKEN"
fi

# Create helpful aliases
cat > /root/.bashrc << 'BASHRC'
alias help='your-agent-cli --help'
# Add more aliases
BASHRC

echo "=========================================="
echo "${AGENT_DISPLAY}: $(your-agent-cli --version)"
echo "Web Terminal: https://${HOSTNAME}"
echo "=========================================="

# Start ttyd
exec ttyd -W -p ${TTYD_PORT:-7681} /bin/bash
```

## Best Practices

### 1. Resource Limits

Always set appropriate resource limits:

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### 2. Health Checks

Include liveness and readiness probes:

```yaml
livenessProbe:
  httpGet:
    path: /
    port: 7681
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /
    port: 7681
  initialDelaySeconds: 10
  periodSeconds: 5
```

### 3. Secret Management

- Never hardcode tokens in manifests
- Use Kubernetes secrets
- Mark secrets as optional if agent can work without them

```yaml
env:
- name: AGENT_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{SECRET_NAME}}
      key: {{SECRET_KEY}}
      optional: true
```

### 4. WebSocket Support

Web terminals require WebSocket support in Ingress/Route:

```yaml
# Kubernetes Ingress
nginx.ingress.kubernetes.io/websocket-services: {{AGENT_NAME}}
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"

# OpenShift Route
haproxy.router.openshift.io/websocket: "true"
haproxy.router.openshift.io/timeout: "1h"
```

### 5. TLS Configuration

Use cert-manager for automatic TLS:

```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-issuer
spec:
  tls:
  - hosts:
    - {{AGENT_HOST}}
    secretName: {{AGENT_NAME}}-tls
```

## Example AI Agents

| Agent | Tool | Repository |
|-------|------|------------|
| GitHub Copilot CLI | `copilot` | `@githubnext/github-copilot-cli` |
| OpenAI CLI | `openai` | `openai-cli` |
| Claude CLI | `claude` | `@anthropic-ai/claude-cli` |
| Cursor | `cursor` | `@cursor/cli` |
| Aider | `aider` | `aider-chat` |

## Troubleshooting

### Common Issues

1. **WebSocket disconnects** - Ensure proxy timeout is set to 3600+
2. **Auth fails** - Check secret exists and has correct key
3. **ttyd not accessible** - Verify service port matches containerPort

### Debug Commands

```bash
# Check pod status
kubectl get pods -n ai-agents -l app={{AGENT_NAME}}

# View logs
kubectl logs -f deployment/{{AGENT_NAME}} -n ai-agents

# Test connection
kubectl port-forward svc/{{AGENT_NAME}} 7681:7681 -n ai-agents
# Open http://localhost:7681
```
