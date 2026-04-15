# OpenShift Console UI Design Research

> Researched 2026-04-14 | Sources: OpenShift 4.15 docs, PatternFly design system, OpenShift Console GitHub repo, YouTube "Ask an OpenShift Admin Ep 47" (console features & customization)

## 1. Left Sidebar Navigation

The OpenShift Console uses a **collapsible vertical masthead/sidebar** built on PatternFly's `Nav` and `Sidebar` components.

### Structure (Administrator Perspective)

```
🏠 Home
   ├── Overview (dashboard)
   ├── Projects
   ├── Search
   └── Events
📦 Operators
   ├── OperatorHub
   └── Installed Operators
🛡️ Service Mesh (if installed)
⚡ Networking
   ├── Routes
   ├── Services
   └── Ingress
📦 Storage
   ├── Persistent Volume Claims
   ├── Storage Classes
   └── Volumes
🔧 Build
   ├── Build Configs
   └── Builds
📋 Pipelines (if OpenShift Pipelines installed)
⚙️ Compute
   ├── Nodes
   ├── Machine Sets
   └── Machine Config Pools
👤 User Management
   ├── Users
   ├── Groups
   ├── OAuth
   └── Service Accounts
🔐 Administration
   ├── Cluster Settings
   ├── Global Configuration
   ├── Custom Resource Definitions
   └── CLI Downloads
```

### Design Details

- **Width:** ~250px expanded, ~56px collapsed (icon-only)
- **Background:** Dark navy (`#1b1d21` in dark theme, `#212427` in light)
- **Icons:** PatternFly icons (outline style), 16-20px, left-aligned
- **Active state:** Left border accent (blue `#2b9af3`), white/bright text
- **Hover:** Subtle background highlight (`rgba(255,255,255,0.08)`)
- **Collapsible:** Toggle button at bottom of sidebar; remembers preference
- **Perspective switcher:** At the very top of the sidebar — dropdown to switch between "Administrator" and "Developer" perspectives
- **Section headers:** Bold, uppercase small text for grouping

### Developer Perspective Sidebar

Simplified navigation focused on app development:
```
📦 Topology (visual graph view)
➕ Add (create/import deploy)
📊 Monitoring
🔍 Search
```

## 2. Namespace Selector / Project Dropdown

### Placement

- Located in the **top masthead bar**, right side of the breadcrumb area
- Visible on every page
- PatternFly `Select` / `TypeaheadSelect` component

### Behavior

- **Label:** Shows current namespace/project name (e.g., "my-project")
- **Icon:** Small grid/cube icon + chevron dropdown
- **Search:** Typeahead filter — type to search across all accessible projects
- **Options:** Lists all projects the user has access to, grouped alphabetically
- **Special options:** "All Projects" (for admin views across namespaces)
- **Width:** ~300px dropdown panel
- **Context persistence:** Selected namespace persists in URL (`/ns/my-project/...`)
- The URL path includes the namespace: `/k8s/ns/{namespace}/deployments`

### Visual Details

- Background: matches masthead (dark in dark theme)
- Border: subtle `#444` border
- Selected item: blue highlight (`#2b9af3`)
- Font: 14px, PatternFly default sans-serif

## 3. Dashboard / Overview Page Layout

### Administrator Overview

The landing dashboard uses a **card-based grid layout**:

```
┌─────────────────────────────────────────────────────────┐
│  Cluster Overview                                        │
├──────────┬──────────┬──────────┬─────────────────────────┤
│ Alerts   │  Health   │ Utilization│                        │
│ Card     │  Card     │ Card      │                        │
├──────────┴──────────┴──────────┴─────────────────────────┤
│  Cluster Inventory (table of resources)                  │
├──────────────────────────────────────────────────────────┤
│  Cluster Utilization (donut/bar charts)                  │
├──────────────────────────────────────────────────────────┤
│  Topology / Activity feed                                │
└──────────────────────────────────────────────────────────┘
```

### Key Cards/Widgets

1. **Alerts Card** — Critical/Warning/Info counts with color coding (red/yellow/blue)
2. **Cluster Health** — Overall health status indicator
3. **Cluster Utilization** — CPU/Memory/Storage gauges (donut charts)
4. **Cluster Inventory** — Table showing counts: Nodes, Pods, Deployments, Services, Routes, etc.
5. **Activity** — Recent events stream

### Card Design

- **Border radius:** 4px (PatternFly standard)
- **Padding:** 24px internal
- **Background:** `#1b1d21` (dark theme) / `#fff` (light)
- **Border:** 1px solid `#444` (dark) / `#ddd` (light)
- **Card header:** Bold 16px title, optional action kebab menu
- **Grid:** CSS Grid, responsive — 2-4 columns depending on viewport

### Developer Overview (Topology View)

- Visual canvas showing pods/deployments as interactive nodes
- Lines connecting services
- Zoom and pan controls
- Click node → side panel with details

## 4. Workloads / Deployments List View

### URL Pattern
`/k8s/ns/{namespace}/deployments`

### Layout

Standard PatternFly **Table (compact)** with toolbar:

```
┌──────────────────────────────────────────────────────────┐
│ [+ Create Deployment]  [Filter input...]  [Columns ▼]   │
├──────────────────────────────────────────────────────────┤
│ ☐ Name          Status    Pods     Age    Labels         │
├──────────────────────────────────────────────────────────┤
│ ☐ my-app        ● Running 3/3     5d     app=my-app     │
│ ☐ api-server    ● Running 2/2     12d    tier=backend   │
│ ☐ frontend      ○ Scaling  1/3    2h     tier=frontend  │
└──────────────────────────────────────────────────────────┘
│ Showing 1-25 of 42 items               [< 1 2 3 >]     │
```

### Table Details

- **Striped rows:** Subtle alternating backgrounds
- **Status indicators:** Colored dots (green=healthy, red=error, yellow=degraded, blue=progressing)
- **Row actions:** Kebab menu (⋮) per row — Edit, Delete, Scale, etc.
- **Bulk actions:** Checkbox selection enables bulk delete/label operations
- **Filtering:** Typeahead text filter above table
- **Sorting:** Click column headers
- **Pagination:** Bottom, 25/50/100 items per page options

## 5. Color Scheme & Dark Theme

### Primary Colors (Dark Theme)

| Token | Hex | Usage |
|-------|-----|-------|
| Background 100 | `#1b1d21` | Sidebar, cards |
| Background 200 | `#212427` | Main content area |
| Background 300 | `#2d2e31` | Table rows (alt) |
| Text primary | `#ececec` | Body text |
| Text secondary | `#8a8d90` | Labels, metadata |
| Blue accent | `#2b9af3` | Active states, links, primary buttons |
| Green | `#3e8635` | Success, healthy |
| Red | `#c9190b` | Error, critical |
| Orange/Yellow | `#f0ab00` | Warning |
| Cyan | `#a2d9f9` | Info |

### Light Theme

| Token | Hex |
|-------|-----|
| Background | `#fff` |
| Sidebar bg | `#1b1d21` (stays dark even in light mode) |
| Text | `#151515` |
| Blue accent | `#0066cc` |

### Typography

- **Font family:** PatternFly default — `Overpass` (headings) + `RedHatText` / system sans-serif (body)
- **Font sizes:**
  - Page title: 24px / 700 weight
  - Section heading: 20px / 600
  - Body: 14px / 400
  - Small/label: 12px / 400
  - Mono (code/pod names): `RedHatMono`, 13px
- **Line height:** 1.5

### Spacing & Padding

- **Sidebar padding:** 16px horizontal, 8px vertical per nav item
- **Page padding:** 24px all sides
- **Card padding:** 24px internal
- **Table cell padding:** 8px vertical, 16px horizontal
- **Grid gap:** 24px between cards
- **Section spacing:** 32px between major sections

## 6. "Add" / "Create" Flows

### Developer Perspective — "Add" Page

This is a **dedicated page** (not a modal) at `/add/ns/{namespace}`:

```
┌─────────────────────────────────────────────────────┐
│  Add to Project                                      │
│                                                      │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐            │
│  │ Git  │  │ Docker│  │ Cat. │  │ YAML │            │
│  │ Repo │  │ File │  │  📦  │  │ Edit │            │
│  └──────┘  └──────┘  └──────┘  └──────┘            │
│                                                      │
│  Developer Catalog ─────────────────────             │
│  ┌──────┐  ┌──────┐  ┌──────┐                       │
│  │ Helm │  │ Dev   │  │ Ser- │                       │
│  │Chart │  │Stack  │  │vice  │                       │
│  └──────┘  └──────┘  └──────┘                       │
└─────────────────────────────────────────────────────┘
```

### Create Options

1. **From Git** — Import code from Git repo, auto-detect builder image
2. **Container Image** — Deploy from existing container image
3. **From Dockerfile** — Provide Dockerfile from git repo
4. **YAML** — Raw YAML editor (full Kubernetes resource)
5. **Developer Catalog** — Browse Helm charts, service brokers, templates

### Form Design Pattern (e.g., Create Deployment)

- **Full-page form** (not modal) with breadcrumb navigation
- **Sections:** Grouped fieldsets with section headers
- **YAML/Form toggle:** Switch between visual form and YAML editor
- **Side panel help:** Contextual help text in right margin
- **Primary action:** Blue "Create" button (top-right)
- **Cancel:** Returns to list view

### YAML Editor

- **Monaco Editor** (same as VS Code)
- Dark themed code editor
- Syntax highlighting for YAML
- Validation errors shown inline

## 7. Overall Aesthetic & Design Principles

### Key Principles

1. **PatternFly 4/5** design system — Red Hat's open-source design system
2. **Information-dense** — Targets ops users who need maximum data visibility
3. **Consistent layout** — Every list view follows the same toolbar → table → pagination pattern
4. **Two perspectives** — Administrator (all resources) vs Developer (app-focused)
5. **Progressive disclosure** — Details hidden behind clicks, not shown all at once

### Component Library

- Built on **React** + **PatternFly React** (`@patternfly/react-core`, `@patternfly/react-table`)
- Charts: **PatternFly React Charts** (based on Victory.js)
- Icons: **PatternFly Icons** (`@patternfly/react-icons`)

### Responsive Behavior

- Desktop-first design (admin consoles are primarily desktop)
- Minimum supported: 1280px width
- Sidebar collapses on smaller screens
- Tables scroll horizontally when needed

## 8. Key UI Patterns to Adopt for ClusterShell

### Recommended Patterns

1. **Left sidebar navigation** — Collapsible, dark background, icon+text items
2. **Namespace selector** — Top-right dropdown with search, persists in URL
3. **Card dashboard** — Grid of status cards for cluster overview
4. **Table list views** — Consistent toolbar + sortable table + pagination
5. **YAML editor** — Monaco for resource editing
6. **Status indicators** — Colored dots for health/ready states
7. **Dark theme default** — Navy/charcoal palette with blue accents

### PatternFly Tokens Reference

For CSS variables and design tokens, see:
- PatternFly CSS variables: `--pf-global--palette--blue-200` etc.
- PatternFly dark theme: `@patternfly/react-core/dist/styles/dark-theme.css`
- PatternFly spacing: `--pf-global--spacer--md` (8px), `--pf-global--spacer--lg` (16px), `--pf-global--spacer--xl` (24px)

## Sources

- OpenShift Container Platform 4.15 Docs — Web Console Overview
- PatternFly Design System (patternfly.org)
- OpenShift Console GitHub Repository (github.com/openshift/console)
- YouTube: "Ask an OpenShift Admin (Ep 47): Console features and customization" — covers console customization, perspectives, and plugin extensions
