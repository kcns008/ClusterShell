import { useEffect, useRef, useCallback } from 'react';
import cytoscape, { Core, NodeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

interface TopologyNode {
  id: string;
  label: string;
  type: 'namespace' | 'agent' | 'service' | 'ingress' | 'pvc';
  status: 'running' | 'stopped' | 'error' | 'pending';
  namespace: string;
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: 'exposes' | 'mounts' | 'contains' | 'routes-to';
}

interface AgentTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

/**
 * Network topology visualization for ClusterShell agent deployments.
 * Inspired by OpenShift Console's Developer perspective topology view:
 * - Nodes represent K8s resources (agents, services, ingresses, PVCs)
 * - Edges show relationships (service exposes pod, ingress routes to service)
 * - Color-coded by status and resource type
 * - Click to select and see details
 * - Double-click to open terminal (for agent pods)
 */
export function AgentTopology() {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<Core | null>(null);

  const fetchTopology = useCallback(async (): Promise<AgentTopology> => {
    const res = await fetch('/api/topology');
    return res.json();
  }, []);

  const getNodeTypeConfig = (type: string, status: string) => {
    const configs: Record<string, { color: string; icon: string; shape: string }> = {
      namespace: { color: '#8b5cf6', icon: '📦', shape: 'roundrectangle' },
      agent: { color: status === 'running' ? '#10b981' : status === 'error' ? '#ef4444' : '#f59e0b', icon: '🤖', shape: 'round-rectangle' },
      service: { color: '#3b82f6', icon: '🔌', shape: 'round-rectangle' },
      ingress: { color: '#8b5cf6', icon: '🌐', shape: 'round-rectangle' },
      pvc: { color: '#6366f1', icon: '💾', shape: 'round-rectangle' },
    };
    return configs[type] || configs.agent;
  };

  const buildGraph = useCallback(async () => {
    if (!cyRef.current) return;

    const topology = await fetchTopology();

    const elements = [
      ...topology.nodes.map((node) => {
        const config = getNodeTypeConfig(node.type, node.status);
        return {
          data: {
            id: node.id,
            label: `${config.icon} ${node.label}`,
            nodeType: node.type,
            status: node.status,
            namespace: node.namespace,
            color: config.color,
          },
        };
      }),
      ...topology.edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          edgeType: edge.type,
        },
      })),
    ];

    const cy = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': 'data(color)',
            'color': '#e5e7eb',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'width': 120,
            'height': 50,
            'shape': 'round-rectangle',
            'text-wrap': 'wrap',
            'text-max-width': '110px',
            'border-width': 2,
            'border-color': '#374151',
            'font-family': "'Inter', sans-serif",
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#58a6ff',
            'border-width': 3,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#4b5563',
            'target-arrow-color': '#4b5563',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
          },
        },
        {
          selector: 'edge[edgeType="exposes"]',
          style: { 'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6' },
        },
        {
          selector: 'edge[edgeType="routes-to"]',
          style: { 'line-color': '#8b5cf6', 'target-arrow-color': '#8b5cf6', 'line-style': 'dashed' },
        },
      ],
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        spacingFactor: 1.5,
        nodeSep: 60,
        rankSep: 120,
      } as any,
    });

    cyInstance.current = cy;

    // Click handler — select node
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      // Dispatch custom event for detail panel
      window.dispatchEvent(new CustomEvent('topology-node-select', {
        detail: node.data(),
      }));
    });

    // Double-click agent nodes to open terminal
    cy.on('dbltap', 'node', (evt) => {
      const data = evt.target.data();
      if (data.nodeType === 'agent') {
        window.dispatchEvent(new CustomEvent('open-terminal', {
          detail: { namespace: data.namespace, podName: data.label.replace(/^[^ ]+ /, '') },
        }));
      }
    });

    return cy;
  }, [fetchTopology]);

  useEffect(() => {
    buildGraph();
    return () => cyInstance.current?.destroy();
  }, [buildGraph]);

  return (
    <div className="relative w-full h-full bg-[#0d1117] rounded-lg border border-gray-700 overflow-hidden">
      {/* Legend */}
      <div className="absolute top-3 right-3 bg-[#161b22] border border-gray-700 rounded-lg p-3 z-10">
        <h3 className="text-xs font-semibold text-gray-400 mb-2">LEGEND</h3>
        {[
          { icon: '🤖', label: 'Agent Pod', color: '#10b981' },
          { icon: '🔌', label: 'Service', color: '#3b82f6' },
          { icon: '🌐', label: 'Ingress', color: '#8b5cf6' },
          { icon: '💾', label: 'PVC', color: '#6366f1' },
          { icon: '📦', label: 'Namespace', color: '#8b5cf6' },
        ].map(({ icon, label, color }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-gray-300 py-0.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span>{icon} {label}</span>
          </div>
        ))}
      </div>
      <div ref={cyRef} className="w-full h-full" />
    </div>
  );
}
