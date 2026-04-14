# ClusterShell Console

Web UI for managing ClusterShell AI agent deployments — inspired by OpenShift Console.

## Features

- **Agent Management** — List, create, delete, and monitor agent pods
- **Web Terminal** — SSH/exec into any agent pod directly from the browser (xterm.js)
- **Network Topology** — Visual map of all agents, services, ingresses, and their connections
- **Real-time Status** — Live pod health, logs, and resource usage

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Agent    │  │ Terminal  │  │  Topology    │  │
│  │ List     │  │ (xterm.js)│  │  (D3/Cytos)  │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
│       │              │               │           │
│       └──────────────┼───────────────┘           │
│                      │ REST + WebSocket          │
├──────────────────────┼───────────────────────────┤
│                  Go Backend                       │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Agent    │  │ Terminal  │  │  K8s API     │  │
│  │ API      │  │ Proxy(WS) │  │  Client      │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
│       │              │               │           │
│       └──────────────┼───────────────┘           │
│                      │ Kubernetes API             │
├──────────────────────┼───────────────────────────┤
│              Kubernetes Cluster                   │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Agent    │  │ Agent     │  │  Agent       │  │
│  │ Pod A    │  │ Pod B     │  │  Pod C       │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
└─────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Start backend
cd backend && go run ./cmd/console

# Start frontend (dev)
cd frontend && npm install && npm run dev
```

## Design Decisions

Based on study of OpenShift Console (github.com/openshift/console):

| Feature | OpenShift Approach | ClusterShell Approach |
|---------|-------------------|----------------------|
| Terminal | xterm.js + WS proxy to kube exec | Same pattern, simplified |
| Topology | D3-based topology graph | Cytoscape.js or D3 force-graph |
| Backend | Go (vendor folder) | Go (standard modules) |
| Frontend | React + PatternFly | React + TailwindCSS |
| K8s API | Direct API + impersonation | client-go + service account |

## License

Apache 2.0
