# GitHub Copilot CLI - Manual Auth Required

The Copilot CLI requires interactive device-flow authentication that must be completed manually.

## Quick Start (Manual Auth)

1. **Open the web terminal:** https://copilot.9ci.dev

2. **Run the auth command:**
   ```bash
   copilot auth
   ```

3. **Copy the device code** shown (e.g., `ABCD-EFGH`)

4. **Authorize at:** https://github.com/login/device

5. **Test it works:**
   ```bash
   copilot what-the-shell "list all files larger than 100MB"
   ```

## Why Manual Auth?

The Copilot CLI uses OAuth device flow for security. This:
- Cannot be fully automated
- Requires browser interaction
- Must be repeated if token expires

## Current Status

| Component | Status |
|-----------|--------|
| GitHub CLI (`gh`) | ✅ Auto-authenticated via GH_TOKEN |
| Token | ✅ Stored in K8s secret (expires 2026-04-01) |
| Copilot CLI | ⏳ Requires one-time device auth |
| Web Terminal | ✅ https://copilot.9ci.dev |

## Troubleshooting

### "Authentication error"

Run `copilot auth` in the web terminal and complete the device flow.

### "Not Found" (404)

You need an active GitHub Copilot subscription:
- Free trial: https://github.com/features/copilot (60 days)
- Individual: $10/month
- Business: Contact your GitHub admin

### Token Expired

Create a new token and update the secret:

```bash
# Create new token at: https://github.com/settings/tokens/new?scopes=repo,copilot

kubectl create secret generic github-copilot-token \
  --from-literal=token=ghp_YOUR_NEW_TOKEN \
  -n github-copilot \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart deployment/github-copilot-cli -n github-copilot
```

## Alternative: Pre-authenticate Locally

If you have Copilot CLI working locally:

1. Run locally:
   ```bash
   copilot auth
   ```

2. Copy the config to the pod:
   ```bash
   kubectl cp ~/.config/github-copilot/ deployment/github-copilot-cli:/root/.config/ -n github-copilot
   ```

3. Restart the pod to pick up the config:
   ```bash
   kubectl rollout restart deployment/github-copilot-cli -n github-copilot
   ```
