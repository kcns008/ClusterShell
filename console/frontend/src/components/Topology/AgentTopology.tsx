import { useEffect, useRef, useCallback, useState } from 'react';
import cytoscape, { Core, NodeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

interface TopologyNode {
  id: string;
  label: string;
  type: 'namespace' | 'agent' | 'service' | 'ingress' | 'pvc' | 'node';
  status: 'running' | 'stopped' | 'error' | 'pending';
  namespace: string;
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: 'exposes' | 'mounts' | 'contains' | 'routes-to';
}

interface AgentTopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  error?: string;
}

interface SelectedNodeInfo {
  id: string;
  label: string;
  nodeType: string;
  status: string;
  namespace: string;
}

type LayoutType = 'dagre' | 'circle' | 'grid' | 'breadthfirst';

/**
 * Enhanced topology visualization for ClusterShell agent deployments.
 * - Multiple layout modes (dagre, circle, grid, breadthfirst)
 * - Detailed info panel on node selection
 * - Zoom controls
 * - Resource type filtering
 * - Port-forward & shell actions from topology
 */
export function AgentTopology() {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<Core | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [selected, setSelected] = useState<SelectedNodeInfo | null>(null);
  const [layout, setLayout] = useState<LayoutType>('dagre');
  const [filter, setFilter] = useState<string>('all');
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const topologyData = useRef<AgentTopologyData | null>(null);

  const fetchTopology = useCallback(async (): Promise<AgentTopologyData> => {
    const res = await fetch('/api/topology');
    if (!res.ok) throw new Error(`Topology API returned ${res.status}`);
    return res.json();
  }, []);

  const typeColorMap: Record<string, string> = {
    namespace: '#8b5cf6',
    agent: '#10b981',
    service: '#3b82f6',
    ingress: '#a855f7',
    pvc: '#6366f1',
    node: '#f59e0b',
  };

  const getNodeColor = (type: string, status: string) => {
    if (type === 'agent') {
      return status === 'running' ? '#10b981' : status === 'error' ? '#ef4444' : '#f59e0b';
    }
    return typeColorMap[type] || '#6b7280';
  };

  const getNodeShape = (type: string) => {
    const shapes: Record<string, string> = {
      namespace: 'round-rectangle',
      agent: 'ellipse',
      service: 'diamond',
      ingress: 'round-pentagon',
      pvc: 'round-hexagon',
      node: 'round-rectangle',
    };
    return shapes[type] || 'ellipse';
  };

  const applyLayout = useCallback((cy: Core, layoutName: LayoutType) => {
    const opts: any = { name: layoutName };
    if (layoutName === 'dagre') {
      opts.rankDir = 'LR';
      opts.spacingFactor = 1.4;
      opts.nodeSep = 50;
      opts.rankSep = 100;
    } else if (layoutName === 'circle') {
      opts.spacingFactor = 1.5;
    } else if (layoutName === 'grid') {
      opts.spacingFactor = 1.5;
    } else if (layoutName === 'breadthfirst') {
      opts.directed = true;
      opts.spacingFactor = 1.3;
    }
    cy.layout(opts).run();
  }, []);

  const buildGraph = useCallback(async () => {
    if (!cyRef.current) return;

    setLoading(true);
    setError(null);
    setEmpty(false);
    setSelected(null);

    let topology: AgentTopologyData;
    try {
      topology = await fetchTopology();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load topology');
      setLoading(false);
      return;
    }

    if (topology.error) {
      setError(topology.error);
      setLoading(false);
      return;
    }

    if (!topology.nodes || topology.nodes.length === 0) {
      setEmpty(true);
      setLoading(false);
      return;
    }

    topologyData.current = topology;

    const filteredNodes = filter === 'all' ? topology.nodes : topology.nodes.filter((n) => n.type === filter);
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = topology.edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

    const elements = [
      ...filteredNodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          nodeType: node.type,
          status: node.status,
          namespace: node.namespace,
          color: getNodeColor(node.type, node.status),
        },
      })),
      ...filteredEdges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          edgeType: edge.type,
        },
      })),
    ];

    setNodeCount(filteredNodes.length);
    setEdgeCount(filteredEdges.length);

    cyInstance.current?.destroy();

    const cy = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': 'data(color)',
            'background-opacity': 0.85,
            'color': '#e5e7eb',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '10px',
            'width': 50,
            'height': 50,
            'text-wrap': 'ellipsis',
            'text-max-width': '80px',
            'text-margin-y': 8,
            'border-width': 2,
            'border-color': '#374151',
            'font-family': "'Inter', sans-serif",
            'overlay-padding': 6,
          } as any,
        },
        {
          selector: 'node[nodeType="namespace"]',
          style: {
            'shape': 'round-rectangle',
            'width': 100,
            'height': 40,
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'font-weight': 'bold',
            'text-margin-y': 0,
          },
        },
        {
          selector: 'node[nodeType="agent"]',
          style: { 'shape': 'ellipse' },
        },
        {
          selector: 'node[nodeType="service"]',
          style: { 'shape': 'diamond', 'width': 45, 'height': 45 },
        },
        {
          selector: 'node[nodeType="ingress"]',
          style: { 'shape': 'round-pentagon', 'width': 45, 'height': 45 },
        },
        {
          selector: 'node[nodeType="pvc"]',
          style: { 'shape': 'round-hexagon', 'width': 40, 'height': 40 },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#58a6ff',
            'border-width': 3,
            'background-opacity': 1,
          },
        },
        {
          selector: 'node:active',
          style: { 'overlay-opacity': 0.1 },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#374151',
            'target-arrow-color': '#374151',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.7,
            'opacity': 0.6,
          },
        },
        {
          selector: 'edge[edgeType="exposes"]',
          style: { 'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6', 'opacity': 0.8 },
        },
        {
          selector: 'edge[edgeType="routes-to"]',
          style: { 'line-color': '#a855f7', 'target-arrow-color': '#a855f7', 'line-style': 'dashed', 'opacity': 0.8 },
        },
        {
          selector: 'edge[edgeType="contains"]',
          style: { 'line-color': '#4b5563', 'target-arrow-color': '#4b5563', 'line-style': 'dotted' },
        },
      ],
      layout: { name: 'preset' } as any,
    });

    applyLayout(cy, layout);
    cyInstance.current = cy;

    cy.on('tap', 'node', (evt) => {
      const data = evt.target.data();
      setSelected({
        id: data.id,
        label: data.label,
        nodeType: data.nodeType,
        status: data.status,
        namespace: data.namespace,
      });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelected(null);
    });

    cy.on('dbltap', 'node', (evt) => {
      const data = evt.target.data();
      if (data.nodeType === 'agent') {
        window.dispatchEvent(new CustomEvent('open-terminal', {
          detail: { namespace: data.namespace, podName: data.label },
        }));
      }
    });

    setLoading(false);
    return cy;
  }, [fetchTopology, layout, filter, applyLayout]);

  useEffect(() => {
    buildGraph();
    return () => cyInstance.current?.destroy();
  }, [buildGraph]);

  const handleZoom = (dir: 'in' | 'out' | 'fit') => {
    const cy = cyInstance.current;
    if (!cy) return;
    if (dir === 'fit') {
      cy.fit(undefined, 40);
    } else {
      const lvl = cy.zoom();
      cy.zoom({ level: dir === 'in' ? lvl * 1.3 : lvl / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    }
  };

  const typeIcon = (type: string) => {
    const icons: Record<string, string> = { namespace: '📁', agent: '🤖', service: '🔌', ingress: '🌐', pvc: '💾', node: '🖥️' };
    return icons[type] || '●';
  };

  return (
    <div className="relative w-full h-full min-h-[400px] bg-[#0d1117] rounded-xl border border-[#2d3748] overflow-hidden flex">
      {/* Main graph area */}
      <div className="flex-1 relative">
        {/* Top toolbar */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          {/* Layout selector */}
          <div className="flex bg-[#161b22] border border-[#2d3748] rounded-lg overflow-hidden">
            {(['dagre', 'circle', 'grid', 'breadthfirst'] as LayoutType[]).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={`px-2.5 py-1.5 text-[10px] font-medium capitalize transition ${
                  layout === l ? 'bg-blue-600 text-white' : 'text-[#8b949e] hover:text-white hover:bg-white/5'
                }`}
              >
                {l === 'breadthfirst' ? 'Tree' : l}
              </button>
            ))}
          </div>
          {/* Filter */}
          <div className="flex bg-[#161b22] border border-[#2d3748] rounded-lg overflow-hidden">
            {['all', 'agent', 'service', 'ingress', 'namespace'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1.5 text-[10px] font-medium capitalize transition ${
                  filter === f ? 'bg-purple-600 text-white' : 'text-[#8b949e] hover:text-white hover:bg-white/5'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {/* Stats */}
          <div className="bg-[#161b22] border border-[#2d3748] rounded-lg px-2.5 py-1.5 text-[10px] text-[#636e7b]">
            {nodeCount} nodes · {edgeCount} edges
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
          <button onClick={() => handleZoom('in')} className="w-8 h-8 bg-[#161b22] border border-[#2d3748] rounded-lg flex items-center justify-center text-[#8b949e] hover:text-white hover:border-[#4a5568] transition text-sm font-bold">+</button>
          <button onClick={() => handleZoom('out')} className="w-8 h-8 bg-[#161b22] border border-[#2d3748] rounded-lg flex items-center justify-center text-[#8b949e] hover:text-white hover:border-[#4a5568] transition text-sm font-bold">−</button>
          <button onClick={() => handleZoom('fit')} className="w-8 h-8 bg-[#161b22] border border-[#2d3748] rounded-lg flex items-center justify-center text-[#8b949e] hover:text-white hover:border-[#4a5568] transition" title="Fit view">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </button>
          <button onClick={buildGraph} className="w-8 h-8 bg-[#161b22] border border-[#2d3748] rounded-lg flex items-center justify-center text-[#8b949e] hover:text-white hover:border-[#4a5568] transition" title="Refresh">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>
        </div>

        {/* Legend — bottom left */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 bg-[#161b22]/90 border border-[#2d3748] rounded-lg px-3 py-2">
          {[
            { label: 'Agent', color: '#10b981', shape: '●' },
            { label: 'Service', color: '#3b82f6', shape: '◆' },
            { label: 'Ingress', color: '#a855f7', shape: '⬠' },
            { label: 'PVC', color: '#6366f1', shape: '⬡' },
            { label: 'Namespace', color: '#8b5cf6', shape: '▢' },
          ].map(({ label, color, shape }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-[#8b949e]">
              <span style={{ color }} className="text-xs">{shape}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#0d1117]/80">
            <div className="flex items-center gap-3 text-[#8b949e]">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm">Loading topology…</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center space-y-3">
              <svg className="w-10 h-10 mx-auto text-[#4a5568]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-[#8b949e]">Failed to load topology</p>
              <p className="text-xs text-[#4a5568] max-w-xs">{error}</p>
              <button
                onClick={buildGraph}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {empty && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-center space-y-2">
              <svg className="w-10 h-10 mx-auto text-[#4a5568]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
              <p className="text-sm text-[#8b949e]">No resources found</p>
              <p className="text-xs text-[#4a5568]">Deploy an agent to see the topology</p>
            </div>
          </div>
        )}

        <div ref={cyRef} className="w-full h-full" />
      </div>

      {/* Detail panel — right side */}
      {selected && (
        <div className="w-64 bg-[#161b22] border-l border-[#2d3748] shrink-0 flex flex-col overflow-auto">
          <div className="px-4 py-3 border-b border-[#2d3748] flex items-center justify-between">
            <h3 className="text-[10px] font-semibold text-[#636e7b] uppercase tracking-widest">Details</h3>
            <button onClick={() => setSelected(null)} className="text-[#636e7b] hover:text-white text-xs">✕</button>
          </div>
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: `${getNodeColor(selected.nodeType, selected.status)}20`, color: getNodeColor(selected.nodeType, selected.status) }}
              >
                {typeIcon(selected.nodeType)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{selected.label}</p>
                <p className="text-[10px] text-[#636e7b] capitalize">{selected.nodeType}</p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                ['Status', selected.status],
                ['Namespace', selected.namespace],
                ['Type', selected.nodeType],
                ['ID', selected.id],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[10px] text-[#636e7b]">{label}</span>
                  <span className={`text-[11px] font-mono ${
                    label === 'Status' && value === 'running' ? 'text-green-400' :
                    label === 'Status' && value === 'error' ? 'text-red-400' :
                    label === 'Status' && value === 'pending' ? 'text-yellow-400' :
                    'text-[#cdd9e5]'
                  }`}>{value}</span>
                </div>
              ))}
            </div>

            {selected.nodeType === 'agent' && (
              <div className="space-y-2 pt-2 border-t border-[#2d3748]">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-terminal', {
                      detail: { namespace: selected.namespace, podName: selected.label },
                    }));
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 rounded-lg transition font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Open Shell
                </button>
                <button
                  onClick={() => {
                    const cmd = `kubectl port-forward pod/${selected.label} 7681:7681 -n ${selected.namespace}`;
                    navigator.clipboard.writeText(cmd);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-amber-600/15 text-amber-400 hover:bg-amber-600/25 rounded-lg transition font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Copy Port-Forward
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
