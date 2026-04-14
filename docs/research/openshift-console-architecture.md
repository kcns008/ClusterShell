# OpenShift Console Architecture Research

*Source: https://github.com/openshift/console (main branch, April 2026)*

---

## 1. General Console Architecture

### Backend (Codename: "Bridge")
- **Language:** Go (>= 1.25)
- **Binary:** `./bin/bridge` (built via `./build.sh`)
- **Key responsibility:** Proxies the Kubernetes API under `/api/kubernetes`, serves static frontend assets, handles user authentication, and provides additional non-Kubernetes APIs

### Frontend
- **Framework:** React + TypeScript
- **Build:** Node.js >= 22 with Yarn Berry (corepack)
- **Package structure:** Monorepo under `frontend/packages/`
  - `console-app` — Main application shell
  - `dev-console` — Developer perspective (Topology, add flows)
  - `topology` — Topology visualization package
  - `console-dynamic-plugin-sdk` — Plugin SDK
  - `shared` — Shared utilities
  - `internal` — Internal components (K8s UI primitives)

### Backend-to-Frontend Bridge
- The Go backend proxies all K8s API calls at `/api/kubernetes`
- Frontend uses SDK functions (`k8sGet`, `k8sCreate`, `k8sList`, etc.) from `console-dynamic-plugin-sdk` to communicate with the backend
- The backend handles OAuth/authentication and injects the user's token into proxied API calls

### Plugin/Extension System
- Based on **webpack module federation** — plugins are loaded at runtime from remote sources
- Delivered via **OLM operators**
- Plugins declare dependencies using semver ranges
- Key entry: `frontend/packages/console-dynamic-plugin-sdk/`
- Extension types defined in `console-extensions.json`
- Template repo: `openshift/console-plugin-template`
- Sample plugin: `dynamic-demo-plugin/`

### Backend Directory Structure (`pkg/`)
```
pkg/
├── auth/          # Authentication logic
├── terminal/      # Web terminal proxy
├── proxy/         # API proxy
├── server/        # HTTP server setup
├── plugins/       # Plugin loading
├── graphql/       # GraphQL support
├── devconsole/    # Dev console specific backend
└── ...
```

---

## 2. Web Terminal / Pod Exec

### Two Separate Terminal Features

OpenShift console has **two distinct terminal features**:

#### A. Pod Terminal Tab (exec into pods)
**Frontend:**
- Uses **xterm.js** for rendering the terminal UI
- The pod terminal component wraps xterm.js and connects via WebSocket
- Located in the internal/shared component library (likely `frontend/packages/internal/` or `frontend/packages/shared/`)
- The K8s SDK (`k8sExec`) from the dynamic-plugin-sdk handles the WebSocket connection setup

**How it works:**
1. Frontend opens a WebSocket to `/api/kubernetes/api/v1/namespaces/{ns}/pods/{pod}/exec?...&command=...&stdin=true&stdout=true&tty=true`
2. The Go backend (`pkg/proxy/`) proxies this WebSocket connection to the Kubernetes API server
3. The K8s API server streams the exec session to the target pod's container runtime
4. Authentication uses the user's OAuth token passed through the console backend proxy

**Authorization:** Standard Kubernetes RBAC — the user's token determines if they have `pods/exec` permission in the target namespace.

#### B. Web Terminal (DevWorkspace-based)
**Backend:**
- `pkg/terminal/proxy.go` — HTTP proxy for web terminal workspaces
- `pkg/terminal/auth.go` — Authentication for terminal access
- `pkg/terminal/client.go` — K8s client for terminal operations
- `pkg/terminal/operator.go` — Web Terminal operator management

**Key endpoint:** `/api/terminal/proxy/`

**How it works:**
1. Uses **DevWorkspace** CRs (`workspace.devfile.io/v1alpha1`) to create terminal workspaces
2. The proxy verifies the requesting user is the workspace creator (via `controller.devfile.io/creator` label)
3. Cluster admins are restricted to the `openshift-terminal` namespace to prevent privilege escalation
4. The proxy forwards requests to the workspace pod after ownership validation
5. Requires the **Web Terminal Operator** to be running

**Key code patterns from `proxy.go`:**
```go
// Verifies workspace ownership
WorkspaceCreatorLabel = "controller.devfile.io/creator"

// Checks if user is cluster admin, enforces namespace restriction
isClusterAdmin, err := p.isClusterAdmin(user.Token)
if isClusterAdmin && namespace != "openshift-terminal" {
    http.Error(w, "cluster-admin users must create terminals in openshift-terminal namespace", http.StatusForbidden)
}

// Validates workspace creator matches current user
userId := user.ID  // Falls back to SelfSubjectReview API if ID is empty
```

---

## 3. Developer Network Topology View

### Visualization Library
- **@patternfly/react-topology** — PatternFly's topology component library
- This is built on top of a force-directed graph layout engine
- Uses MobX for state management of the graph model

### Component Architecture

```
TopologyPage.tsx (dev-console)
  └── Topology (from @console/topology package)
       └── TopologyPage.tsx (topology package)
            └── DataModelProvider  — Provides the data model context
                 └── TopologyDataRenderer  — Renders graph or list view
                      └── Topology.tsx  — The actual graph visualization
                           ├── Visualization (from @patternfly/react-topology)
                           ├── VisualizationSurface  — SVG rendering surface
                           ├── VisualizationProvider  — Context provider
                           ├── TopologyControlBar  — Zoom/layout controls
                           └── componentFactory  — Custom node/edge renderers
```

### Key Files

| File | Purpose |
|------|---------|
| `frontend/packages/dev-console/src/components/topology/TopologyPage.tsx` | Entry point (thin wrapper) |
| `frontend/packages/topology/src/components/page/TopologyPage.tsx` | Main page with namespace handling |
| `frontend/packages/topology/src/components/page/TopologyDataRenderer.tsx` | Renders graph or list view |
| `frontend/packages/topology/src/components/graph-view/Topology.tsx` | **Core graph component** using `Visualization` + `VisualizationSurface` |
| `frontend/packages/topology/src/components/graph-view/layouts/` | Layout algorithms (force-directed, etc.) |
| `frontend/packages/topology/src/components/graph-view/components/` | Custom node/edge component factories |
| `frontend/packages/topology/src/data-transforms/data-transformer.ts` | **Transforms K8s resources → graph model** |
| `frontend/packages/topology/src/data-transforms/updateTopologyDataModel.ts` | Orchestrates model updates |
| `frontend/packages/topology/src/data-transforms/transform-utils.ts` | Utility functions for node/edge creation |

### Data Model & Edge/Connection Logic

**Node types (constants):**
- `TYPE_WORKLOAD` — Deployments, DeploymentConfigs, StatefulSets, DaemonSets, Jobs, CronJobs
- `TYPE_APPLICATION_GROUP` — Application grouping
- `TYPE_TRAFFIC_CONNECTOR` — Service mesh traffic edges

**How edges/connections are determined:**

1. **Visual Connectors** (`createVisualConnectors` in `data-transformer.ts`):
   - Created from workload resource annotations/labels (e.g., `app.openshift.io/vcs-uri`)
   - `getTopologyEdgeItems()` in `transform-utils.ts` determines connections between workloads based on shared labels or explicit references

2. **Traffic Connectors** (`createTrafficConnectors`):
   - Integrates with **Kiali** (service mesh observability)
   - Traffic data includes source/target workloads and traffic metrics
   - Edges are created by matching Kiali node IDs to K8s resource UIDs

3. **Grouping:**
   - Workloads with the same `app.kubernetes.io/part-of` or `app.openshift.io/runtime` label are grouped
   - `mergeGroup()` creates `TYPE_APPLICATION_GROUP` nodes

**Key pattern from `Topology.tsx`:**
```tsx
import { Visualization, VisualizationSurface, VisualizationProvider } from '@patternfly/react-topology';

const graphModel: Model = {
  graph: {
    id: 'odc-topology-graph',
    type: 'graph',
    layout: DEFAULT_LAYOUT,
    layers: [BOTTOM_LAYER, GROUPS_LAYER, 'groups2', DEFAULT_LAYER, TOP_LAYER],
  },
};
```

**Data flow:**
1. `TopologyDataRetriever` watches K8s resources via SDK hooks
2. `updateTopologyDataModel()` transforms raw K8s resources into `Model` (nodes + edges)
3. `baseDataModelGetter()` processes WORKLOAD_TYPES, creates nodes for each resource
4. Extensions can contribute additional nodes/edges via `dataModelDepicters`
5. The `Visualization` controller from PatternFly renders the model

### Extension Points
- `TopologyComponentFactory` extension type — plugins can register custom node/edge renderers
- `DataModelExtension` — plugins can contribute to the topology data model
- Resolved via `useResolvedExtensions(isTopologyComponentFactory)`

---

## Summary for ClusterShell Implementation

### Pod Exec Terminal
- **Pattern:** Frontend xterm.js → WebSocket → Backend proxy → K8s API `/exec` subprotocol
- **Simple approach:** Proxy WebSocket connections with user's auth token
- **Key insight:** No special backend needed beyond token-aware WebSocket proxying to K8s API

### Topology View
- **Library:** @patternfly/react-topology (NOT D3 directly)
- **Pattern:** K8s resources → data transformer → graph Model (nodes + edges) → Visualization component
- **Edge logic:** Based on labels (shared app labels) + optional service mesh data (Kiali)
- **Key insight:** Clean separation between data transformation and rendering

### Plugin System
- **Pattern:** Webpack module federation for runtime plugin loading
- **Extension points:** Declared in JSON, resolved at runtime
- **Key insight:** PatternFly's extension system is the foundation
