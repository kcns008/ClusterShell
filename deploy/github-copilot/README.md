# GitHub Copilot CLI Deployment

Browser-accessible GitHub Copilot CLI with web terminal (ttyd).

## Features

- **GitHub CLI (gh)** v2.40.1
- **GitHub Copilot CLI** (latest)
- **Web Terminal** via ttyd for browser access
- **Auto-authentication** for GitHub CLI using GH_TOKEN
- **TLS** via cert-manager (Kubernetes) or OpenShift Router

## Prerequisites

### Required
1. Kubernetes cluster with nginx ingress controller, **OR** OpenShift 4.x
2. GitHub Personal Access Token with `repo` and `copilot` scopes
3. **Active GitHub Copilot subscription** (https://github.com/features/copilot)

### Kubernetes
- cert-manager with a cluster issuer (e.g., `letsencrypt-issuer`)

### OpenShift
- OpenShift Router configured

## Quick Start

### 1. Deploy to Kubernetes

```bash
# Apply the deployment
kubectl apply -f deployment.yaml

# Create secret with your GitHub token
kubectl create secret generic github-copilot-token \
  --from-literal=token=ghp_YOUR_TOKEN \
  -n github-copilot
```

### 2. Or Deploy to OpenShift

```bash
# Apply the deployment
oc apply -f deployment-openshift.yaml

# Create secret with your GitHub token
oc create secret generic github-copilot-token \
  --from-literal=token=ghp_YOUR_TOKEN \
  -n github-copilot
```

### 3. Customize for Your Environment

Edit `deployment.yaml` (or `deployment-openshift.yaml`) and update:

```yaml
# In ConfigMap
data:
  HOSTNAME: "copilot.your-domain.com"

# In Ingress/Route
spec:
  rules:
  - host: copilot.your-domain.com
```

### 4. Access the Web Terminal

1. Point your DNS to the ingress IP
2. Open: `https://copilot.your-domain.com`
3. Run: `copilot auth` (one-time setup)
4. Start using: `copilot what-the-shell "your query"`

## GitHub Copilot CLI Commands

```bash
# Shell commands from natural language
copilot what-the-shell "find all files larger than 100MB modified in last week"

# Git commands
copilot git-assist "undo last commit but keep changes"

# GitHub CLI commands
copilot gh-assist "create a new repo called my-app and push to it"
```

### Aliases (available in web terminal)

```bash
wts 'query'    # copilot what-the-shell
ga 'query'     # copilot git-assist
gha 'query'    # copilot gh-assist
```

## Configuration

### Create GitHub Token

1. Go to: https://github.com/settings/tokens/new
2. Select scopes: `repo`, `copilot`
3. Generate and copy token
4. Create secret:

```bash
kubectl create secret generic github-copilot-token \
  --from-literal=token=ghp_YOUR_TOKEN \
  -n github-copilot
```

### Resource Requirements

| Resource | Request | Limit |
|----------|---------|-------|
| Memory | 256Mi | 512Mi |
| CPU | 200m | 500m |

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          Ingress / Route            │
                    │   copilot.your-domain.com (TLS)     │
                    └──────────────┬──────────────────────┘
                                   │ :443
                                   ▼
                    ┌─────────────────────────────────────┐
                    │           Service                   │
                    │      github-copilot-cli:7681        │
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
│  │                    Copilot CLI Tools                         │ │
│  │  - gh (GitHub CLI)                                          │ │
│  │  - copilot (GitHub Copilot CLI)                             │ │
│  │  - git, curl, bash                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Secrets: github-copilot-token (GH_TOKEN)                        │
│  ConfigMap: github-copilot-config                                │
└───────────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Check Pod Logs

```bash
kubectl logs -f deployment/github-copilot-cli -n github-copilot
```

### Check Authentication

```bash
kubectl exec deployment/github-copilot-cli -n github-copilot -- gh auth status
```

### "Authentication error" from Copilot CLI

The Copilot CLI requires device authentication. Run in the web terminal:

```bash
copilot auth
```

Then complete the device flow at https://github.com/login/device

### "Not Found" (404) Error

Ensure you have an active GitHub Copilot subscription:
- Free trial: https://github.com/features/copilot (60 days)
- Individual: $10/month
- Business: Contact your GitHub admin

### Restart Pod

```bash
kubectl rollout restart deployment/github-copilot-cli -n github-copilot
```

## Security Notes

- The web terminal provides full shell access - protect with appropriate network policies
- Token is stored in Kubernetes secret with appropriate RBAC
- Consider adding authentication layer (OAuth, SSO) for production use
- WebSocket support required for ttyd web terminal

## Related

- `AUTH.md` - Detailed authentication instructions
- `kustomization.yaml` - Kustomize configuration
- https://docs.github.com/en/copilot - GitHub Copilot documentation
