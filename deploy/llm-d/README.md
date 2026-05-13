# LLM Inference with llm-d

This directory deploys [llm-d](https://github.com/llm-d/llm-d) — a CNCF sandbox project for high-performance distributed LLM inference on Kubernetes — integrated with ClusterShell's sandboxed agent runtime.

llm-d provides intelligent routing, KV-cache management, prefill/decode disaggregation, and SLO-aware autoscaling. It works with vLLM and SGLang as model servers. Founded by Red Hat, Google, IBM, CoreWeave, and NVIDIA.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ClusterShell Cluster                         │
│                                                                     │
│  ┌──────────────┐       ┌───────────────────┐      ┌─────────────┐ │
│  │   Sandbox     │       │  llm-d Route       │      │  vLLM Pod   │ │
│  │   (Agent)     │──────▶│  Scheduler          │─────▶│  (Model A)  │ │
│  │               │  :8000│                     │      │  GPU: 1     │ │
│  └──────────────┘       │  · Prefix-cache     │      └─────────────┘ │
│                          │    aware routing    │                      │
│  OPENAI_BASE_URL=        │  · Load-aware       │      ┌─────────────┐ │
│  http://llm-d-router     │  · Predicted        │─────▶│  vLLM Pod   │ │
│                          │    latency sched    │      │  (Model B)  │ │
│                          └───────────────────┘      │  GPU: 1     │ │
│                                                       └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Agents running inside ClusterShell sandboxes point `OPENAI_BASE_URL` at the llm-d router service. The router handles request-level scheduling across vLLM (or SGLang) backend pods.

## Deployment Tiers

### Quickstart — Single GPU

vLLM only, no router. Good for testing and development.

```bash
kubectl apply -f quickstart.yaml
```

- 1 vLLM replica, 1 GPU
- Llama 3.1 8B Instruct (or any small model)
- Direct access, no routing layer

### Standard — llm-d Router + Multi-GPU

Adds the llm-d routing proxy in front of multiple vLLM replicas.

```bash
kubectl apply -f examples/standard.yaml
```

- llm-d router with prefix-cache-aware routing
- 2 vLLM replicas
- Load-balanced inference with smart scheduling

### Production — Full Stack

Prefill/decode disaggregation, KV-cache offloading, autoscaling.

```bash
kubectl apply -f examples/production.yaml
```

- Separate prefill and decode pools for large models
- KV-cache offload to CPU/disk
- HPA autoscaling based on request latency
- Multiple model endpoints

## Prerequisites

- **GPU nodes** with NVIDIA A100/H100/L40S (or any CUDA-capable GPU)
- **NVIDIA device plugin** installed: `kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.16.2/deployments/static/nvidia-device-plugin.yaml`
- **NVIDIA Container Toolkit** on each GPU node
- **Helm 3** (for values.yaml-based deployment)
- **kubectl** with cluster admin access

## Quick Start

Apply the single-file manifest to get a vLLM server and llm-d router running:

```bash
kubectl apply -f quickstart.yaml
kubectl wait --for=condition=available deployment/vllm-server -n clustershell-inference --timeout=300s
```

Then point your ClusterShell sandbox at the router:

```bash
clustershell sandbox create -- claude
clustershell policy set <name> --policy - <<EOF
inference:
  backend:
    url: http://llm-d-router.clustershell-inference.svc:8000
EOF
```

Or set it directly in a Sandbox CRD — see [`examples/sandbox-inference.yaml`](examples/sandbox-inference.yaml).

## Using with ClusterShell Agents

Agents inside sandboxes access llm-d by setting the `OPENAI_BASE_URL` environment variable:

```
OPENAI_BASE_URL=http://llm-d-router.clustershell-inference.svc:8000
```

The router exposes an OpenAI-compatible API, so any agent that uses the OpenAI SDK (Claude Code, OpenCode, Codex, Copilot) works without code changes.

### Sandbox CRD Example

```yaml
apiVersion: agent-sandbox.io/v1
kind: Sandbox
metadata:
  name: llm-powered-agent
spec:
  image: ghcr.io/nvidia/openshell-community/sandboxes/base:latest
  agent: claude
  env:
    - name: OPENAI_BASE_URL
      value: http://llm-d-router.clustershell-inference.svc:8000
```

## Helm Deployment

```bash
helm install llm-d . -f values.yaml -n clustershell-inference --create-namespace
```

See [`values.yaml`](values.yaml) for configuration options.

## Kustomize

```bash
kubectl apply -k .
```

## References

- [llm-d Documentation](https://llm-d.ai/docs)
- [llm-d Quickstart](https://llm-d.ai/docs/getting-started/quickstart)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [vLLM Documentation](https://docs.vllm.ai/)
