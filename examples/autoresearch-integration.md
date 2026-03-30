# Running Autoresearch in ClusterShell

This example shows how to run [karpathy/autoresearch](https://github.com/karpathy/autoresearch) inside a ClusterShell sandbox for isolated, policy-controlled autonomous AI research.

## Why ClusterShell for Autoresearch?

1. **Isolation**: Experiments run in a sandboxed container
2. **Policy Control**: Limit network access to only needed APIs
3. **Resource Limits**: GPU and memory constraints
4. **Cleanup**: Automatic cleanup when experiment is done
5. **Security**: Credentials are injected, not stored

## Quick Start

### 1. Create the Sandbox

```bash
# Create a sandbox with GPU support (required for autoresearch)
clustershell sandbox create --name autoresearch --gpu

# Or without GPU (for CPU-only experiments)
clustershell sandbox create --name autoresearch
```

### 2. Connect and Set Up

```bash
# Connect to the sandbox
clustershell sandbox connect autoresearch

# Inside the sandbox:
git clone https://github.com/karpathy/autoresearch
cd autoresearch
uv sync
uv run prepare.py
```

### 3. Run Autonomous Research

Point your agent at the sandbox and give it the autoresearch program:

```
Read program.md and let's kick off a new experiment!
```

The agent will:
1. Create an experiment branch
2. Run training experiments every 5 minutes
3. Log results to results.tsv
4. Keep improvements, discard regressions
5. Continue indefinitely

### 4. Monitor Progress

```bash
# From your host machine:
clustershell logs autoresearch --tail

# Check results
clustershell sandbox exec autoresearch -- cat autoresearch/results.tsv
```

### 5. Cleanup

```bash
# When done, delete the sandbox
clustershell sandbox delete autoresearch
```

## Policy Configuration

For autoresearch, you typically need minimal network access:

```yaml
# experiments/autoresearch-policy.yaml
network:
  rules:
    - name: huggingface
      allow:
        - host: "*.huggingface.co"
          methods: [GET]
    - name: pypi
      allow:
        - host: "pypi.org"
          methods: [GET]
        - host: "files.pythonhosted.org"
          methods: [GET]
```

Apply the policy:

```bash
clustershell policy set autoresearch --policy experiments/autoresearch-policy.yaml
```

## GPU Considerations

### Requirements

- NVIDIA GPU on the host
- NVIDIA Container Toolkit installed
- CUDA drivers matching your workload

### GPU Passthrough

```bash
# Create GPU-enabled sandbox
clustershell sandbox create --name autoresearch-gpu --gpu

# Verify GPU access inside sandbox
clustershell sandbox exec autoresearch-gpu -- nvidia-smi
```

### Resource Limits

Control GPU memory usage:

```yaml
# In your sandbox policy
resources:
  gpu:
    memory: 16GB  # Limit GPU memory
```

## Multi-Experiment Setup

Run multiple autoresearch instances in parallel:

```bash
# Create multiple sandboxes
clustershell sandbox create --name exp-gpu0 --gpu
clustershell sandbox create --name exp-gpu1 --gpu

# Each runs its own experiment branch
# autoresearch/mar30-gpu0
# autoresearch/mar30-gpu1
```

## Result Collection

Collect results from all experiments:

```bash
# Copy results from sandbox to host
clustershell sandbox exec autoresearch -- cat autoresearch/results.tsv > local-results.tsv

# Or use the experiment-tracking skill to analyze
```

## Full Example Script

```bash
#!/bin/bash
# run-autoresearch.sh

set -e

# Configuration
EXP_NAME="${1:-autoresearch-$(date +%Y%m%d)}"
GPU="${2:---gpu}"

echo "Creating sandbox: $EXP_NAME"
clustershell sandbox create --name "$EXP_NAME" $GPU

echo "Applying policy..."
clustershell policy set "$EXP_NAME" --policy experiments/autoresearch-policy.yaml

echo "Setting up autoresearch..."
clustershell sandbox exec "$EXP_NAME" -- bash -c '
  git clone https://github.com/karpathy/autoresearch
  cd autoresearch
  uv sync
  uv run prepare.py
  echo "Ready for autonomous research!"
  echo "Point your agent at this sandbox and reference program.md"
'

echo ""
echo "Sandbox ready: $EXP_NAME"
echo "Connect with: clustershell sandbox connect $EXP_NAME"
echo "Then point your agent at ~/autoresearch with program.md instructions"
```

## Comparison: Raw vs ClusterShell

| Aspect | Raw Execution | ClusterShell |
|--------|---------------|--------------|
| Isolation | Shared system | Container sandbox |
| Network | Unrestricted | Policy-controlled |
| GPU | Direct access | Passthrough with limits |
| Credentials | On disk | Injected at runtime |
| Cleanup | Manual | Automatic |
| Multi-tenant | Risky | Safe |

## Troubleshooting

### GPU Not Visible

```bash
# Check host GPU
nvidia-smi

# Check NVIDIA Container Toolkit
docker run --gpus all nvidia/cuda:12.0-base nvidia-smi

# Recreate sandbox with --gpu
clustershell sandbox delete autoresearch
clustershell sandbox create --name autoresearch --gpu
```

### Network Blocked

```bash
# Check current policy
clustershell policy get autoresearch

# Update policy to allow needed hosts
clustershell policy set autoresearch --policy experiments/autoresearch-policy.yaml
```

### Out of Memory

```bash
# Reduce model size in train.py
# Or use smaller batch size
# Or request smaller GPU sandbox
```

## See Also

- `autonomous-experiment` skill - Running experiment loops
- `experiment-tracking` skill - Analyzing results
- [autoresearch README](https://github.com/karpathy/autoresearch)
