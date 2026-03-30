# GitHub Copilot CLI Deployment

Browser-accessible GitHub Copilot CLI with web terminal (ttyd).

## Features

- **GitHub CLI (gh)** v2.40.1
- **GitHub Copilot CLI** v0.1.36
- **Web Terminal** via ttyd for browser access
- **Auto-authentication** for GitHub CLI using GH_TOKEN
- **TLS** via cert-manager (Kubernetes) or OpenShift Router

## Prerequisites

### GitHub Copilot Subscription
You must have an active GitHub Copilot subscription:
- Individual: https://github.com/features/copilot
- Business: https://github.com/features/copilot/business

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
# https://github.com/settings/tokens/new?scopes=repo,copilot

kubectl create secret generic github-copilot-token \
  --from-literal=token=ghp_YOUR_TOKEN \
  -n github-copilot
```

### 3. Deploy

```bash
# Using kubectl
kubectl apply -f deployment.yaml

# Or using kustomize
kubectl apply -k .
```

### 4. Authenticate Copilot CLI

**IMPORTANT:** The Copilot CLI requires separate authentication (device flow).

1. Open the web terminal: https://copilot.9ci.dev

2. Run the auth command:
   ```bash
   copilot auth
   ```

3. Complete the device flow:
   - Copy the code shown (e.g., `ABCD-EFGH`)
   - Go to https://github.com/login/device
   - Paste the code and authorize

4. Test it works:
   ```bash
   copilot what-the-shell "list all files larger than 100MB"
   ```

### 5. Access Web Terminal

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
| `HOSTNAME` | copilot.9ci.dev | Public hostname |
| `GH_TOKEN` | (from secret) | GitHub PAT for gh CLI |
| `GITHUB_TOKEN` | (from secret) | GitHub PAT (alternate) |

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

### GitHub CLI

The `gh` CLI is authenticated automatically with your token:

```bash
gh repo list
gh issue list
gh pr create
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
│  │  - gh (GitHub CLI) - auto-auth via GH_TOKEN                 │ │
│  │  - copilot (GitHub Copilot CLI) - run `copilot auth`        │ │
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
echo "alias myalias='my command'" >> /root/.bashrc
```

## Troubleshooting

### Check Pod Logs

```bash
kubectl logs -f deployment/github-copilot-cli -n github-copilot
```

### Check Authentication

```bash
# GitHub CLI
kubectl exec deployment/github-copilot-cli -n github-copilot -- gh auth status

# Copilot CLI (requires device flow)
kubectl exec -it deployment/github-copilot-cli -n github-copilot -- copilot auth
```

### Restart Pod

```bash
kubectl rollout restart deployment/github-copilot-cli -n github-copilot
```

### "Authentication error" from Copilot CLI

This means you need to run `copilot auth` in the web terminal:
1. Open https://copilot.9ci.dev
2. Run `copilot auth`
3. Complete the device flow

## OpenShift Deployment

For OpenShift, use `deployment-openshift.yaml` instead:

```bash
oc apply -f deployment-openshift.yaml
```

Update the hostname in the ConfigMap and Route to match your OpenShift domain.
