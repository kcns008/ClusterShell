# GitHub Copilot CLI Deployment

Browser-accessible GitHub Copilot CLI with web terminal (ttyd).

## Features

- **GitHub CLI (gh)** v2.40.1
- **GitHub Copilot CLI** v0.1.36
- **Web Terminal** via ttyd for browser access
- **Auto-authentication** using GitHub token from secret
- **TLS** via cert-manager (Kubernetes) or OpenShift Router

## Prerequisites

### Kubernetes
1. cert-manager with `letsencrypt-issuer` cluster issuer
2. nginx ingress controller

### OpenShift
1. OpenShift Router configured

## Quick Start

### 1. Create Namespace

```bash
kubectl create namespace github-copilot
```

### 2. Create GitHub Token Secret

```bash
# Create a GitHub Personal Access Token with repo and copilot scopes
# https://github.com/settings/tokens

kubectl create secret generic github-copilot-token \
  --from-literal=token=ghp_YOUR_TOKEN_HERE \
  -n github-copilot
```

### 3. Deploy

```bash
# Using kubectl
kubectl apply -f deployment.yaml

# Or using kustomize
kubectl apply -k .
```

### 4. Access Web Terminal

Add to `/etc/hosts`:
```
45.79.63.127 copilot.9ci.dev
```

Open: https://copilot.9ci.dev

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TTYD_PORT` | 7681 | Web terminal port |
| `TTYD_THEME` | dark | ttyd theme |
| `HOSTNAME` | copilot.9ci.dev | Public hostname |
| `GH_TOKEN` | (from secret) | GitHub token |

### Resources

| Resource | Request | Limit |
|----------|---------|-------|
| Memory | 256Mi | 512Mi |
| CPU | 200m | 500m |

## Usage

### Copilot CLI Commands

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

### Manual Authentication

If you didn't provide a token:

```bash
# GitHub CLI
gh auth login

# Copilot CLI
copilot auth
```

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          Ingress / Route            │
                    │   copilot.9ci.dev (TLS via LE)      │
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

## Customization

### Change Hostname

Edit `deployment.yaml`:

```yaml
# In ConfigMap
data:
  HOSTNAME: "copilot.your-domain.com"

# In Ingress
spec:
  rules:
  - host: copilot.your-domain.com
```

### Add Custom Aliases

Edit the bashrc section in the deployment:

```bash
cat > /root/.bashrc << 'BASHRC'
alias myalias='my command'
# ... more aliases
BASHRC
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

### Restart Pod

```bash
kubectl rollout restart deployment/github-copilot-cli -n github-copilot
```

## OpenShift Deployment

For OpenShift, use `deployment-openshift.yaml` instead:

```bash
oc apply -f deployment-openshift.yaml
```

Update the hostname in the ConfigMap and Route to match your OpenShift domain.
