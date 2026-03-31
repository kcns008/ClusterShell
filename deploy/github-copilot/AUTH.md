# GitHub Copilot CLI - Authentication Guide

The Copilot CLI requires authentication to access GitHub's Copilot services.

## Prerequisites

1. **Active GitHub Copilot subscription** (required)
   - Free trial: https://github.com/features/copilot (60 days)
   - Individual: $10/month
   - Business: Contact your organization admin

2. **GitHub Personal Access Token** with scopes:
   - `repo` - Repository access
   - `copilot` - Copilot API access

## Authentication Methods

### Method 1: Token in Kubernetes Secret (Recommended)

Create a secret with your token:

```bash
kubectl create secret generic github-copilot-token \
  --from-literal=token=ghp_YOUR_TOKEN \
  -n github-copilot
```

The pod will automatically:
- Configure GitHub CLI (`gh`) with the token
- Create Copilot config directory
- Store token for Copilot CLI

### Method 2: Device Flow (Manual)

Run in the web terminal:

```bash
copilot auth
```

Then:
1. Copy the device code shown (e.g., `ABCD-EFGH`)
2. Go to https://github.com/login/device
3. Paste the code and authorize

### Method 3: Pre-authenticate Locally

If Copilot CLI works on your local machine:

```bash
# Authenticate locally
copilot auth
# Complete device flow...

# Copy config to pod
kubectl cp ~/.config/github-copilot/ deployment/github-copilot-cli:/root/.config/ -n github-copilot

# Restart pod to apply
kubectl rollout restart deployment/github-copilot-cli -n github-copilot
```

## Verify Authentication

```bash
# Check GitHub CLI
kubectl exec deployment/github-copilot-cli -n github-copilot -- gh auth status

# Check Copilot CLI
kubectl exec -it deployment/github-copilot-cli -n github-copilot -- copilot what-the-shell "echo hello"
```

## Troubleshooting

### "Authentication error"

- Ensure you have an active Copilot subscription
- Verify token has `repo` and `copilot` scopes
- Run `copilot auth` to complete device flow

### "Not Found" (404)

- Copilot subscription required
- Check subscription status: https://github.com/settings/copilot

### Token Expired

Create a new token and update the secret:

```bash
kubectl create secret generic github-copilot-token \
  --from-literal=token=ghp_NEW_TOKEN \
  -n github-copilot \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart deployment/github-copilot-cli -n github-copilot
```

### Permission Denied

Ensure the secret has the correct key:

```bash
kubectl get secret github-copilot-token -n github-copilot -o jsonpath='{.data.token}' | base64 -d
```

Should show your token value.
