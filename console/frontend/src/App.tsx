import { useState, useEffect, useCallback } from 'react';
import { AgentShell } from './components/Shell/AgentShell';
import { AgentTopology } from './components/Topology/AgentTopology';
import { DeployModal } from './components/DeployAgent/DeployModal';
import { AdminPanel } from './components/Admin/AdminPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AgentPod {
  name: string;
  namespace: string;
  status: string;
  image: string;
  ip: string;
  node: string;
  ports: string[];
  created: string;
  template: string;
}

interface Namespace {
  name: string;
  status: string;
}

type View = 'dashboard' | 'agents' | 'topology' | 'settings';
type ShellSession = {
  id: string;
  namespace: string;
  podName: string;
  template: string;
};

// ---------------------------------------------------------------------------
// Inline SVG icons (zero deps)
// ---------------------------------------------------------------------------
const Icons = {
  dashboard: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  agents: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  topology: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  admin: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  settings: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  plus: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  chevron: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  shell: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function Sidebar({
  view,
  setView,
  onDeploy,
}: {
  view: View;
  setView: (v: View) => void;
  onDeploy: () => void;
}) {
  const main: { id: View; label: string; icon: JSX.Element }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
    { id: 'agents', label: 'Agent Pods', icon: Icons.agents },
    { id: 'topology', label: 'Topology', icon: Icons.topology },
  ];

  return (
    <div className="w-56 bg-[#0d1117] border-r border-[#1f2937] flex flex-col h-full select-none">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-[#1f2937]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
            CS
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">ClusterShell</h1>
            <p className="text-[10px] text-[#636e7b]">Console</p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {main.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
              view === item.id
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-[#8b949e] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        {/* Deploy button */}
        <div className="pt-3 px-1">
          <button
            onClick={onDeploy}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-medium rounded-lg transition-all shadow-md shadow-blue-600/20"
          >
            {Icons.plus}
            Deploy Agent
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-[#1f2937] space-y-0.5">
        <button
          onClick={() => setView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all ${
            view === 'settings' ? 'bg-white/5 text-white' : 'text-[#636e7b] hover:text-[#8b949e]'
          }`}
        >
          {Icons.settings}
          Settings
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] text-[#4a5568]">dev-barn · Online</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Namespace Selector
// ---------------------------------------------------------------------------
function NamespaceSelector({
  namespaces,
  selected,
  onChange,
}: {
  namespaces: Namespace[];
  selected: string;
  onChange: (ns: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border border-[#2d3748] rounded-lg text-[13px] text-[#cdd9e5] hover:border-[#4a5568] transition"
      >
        <span className="text-[#636e7b]">Project:</span>
        <span className="font-medium">{selected === '_all' ? 'All' : selected}</span>
        {Icons.chevron}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-[#161b22] border border-[#2d3748] rounded-xl shadow-xl z-50 max-h-64 overflow-auto py-1">
          <button
            onClick={() => {
              onChange('_all');
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-[13px] hover:bg-white/5 transition ${
              selected === '_all' ? 'text-blue-400' : 'text-[#cdd9e5]'
            }`}
          >
            All Projects
          </button>
          {namespaces.map((ns) => (
            <button
              key={ns.name}
              onClick={() => {
                onChange(ns.name);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[13px] hover:bg-white/5 transition ${
                selected === ns.name ? 'text-blue-400' : 'text-[#cdd9e5]'
              }`}
            >
              {ns.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard View
// ---------------------------------------------------------------------------
function DashboardView({
  agents,
  namespaces,
}: {
  agents: AgentPod[];
  namespaces: Namespace[];
}) {
  const running = agents.filter((a) => a.status === 'Running').length;
  const namespacesWithAgents = new Set(agents.map((a) => a.namespace)).size;

  const cards = [
    { label: 'Agent Pods', value: agents.length, sub: `${running} running`, gradient: 'from-blue-500 to-blue-600', icon: '🤖' },
    { label: 'Namespaces', value: namespaces.length, sub: `${namespacesWithAgents} with agents`, gradient: 'from-purple-500 to-purple-600', icon: '📦' },
    { label: 'Running', value: running, sub: `of ${agents.length} total`, gradient: 'from-green-500 to-green-600', icon: '✅' },
    { label: 'Clusters', value: 1, sub: 'dev-barn (LKE)', gradient: 'from-orange-500 to-orange-600', icon: '🔗' },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#161b22] border border-[#2d3748] rounded-xl p-5 hover:border-[#4a5568] transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-[#636e7b] font-semibold uppercase tracking-widest">{c.label}</p>
                <p className="text-3xl font-bold text-white mt-1.5">{c.value}</p>
                <p className="text-xs text-[#4a5568] mt-1">{c.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-lg shadow-lg`}>
                {c.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent agents */}
      <div className="bg-[#161b22] border border-[#2d3748] rounded-xl">
        <div className="px-5 py-4 border-b border-[#2d3748]">
          <h3 className="text-sm font-semibold text-white">Recent Agent Pods</h3>
        </div>
        <div className="divide-y divide-[#2d3748]">
          {agents.slice(0, 5).map((a) => (
            <div key={`${a.namespace}-${a.name}`} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.015] transition">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${a.status === 'Running' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <div>
                  <p className="text-sm text-white font-mono">{a.name}</p>
                  <p className="text-xs text-[#4a5568]">
                    {a.namespace} · {a.image?.split('/').pop()?.split(':')[0]}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  a.status === 'Running' ? 'bg-green-600/10 text-green-400' : 'bg-yellow-600/10 text-yellow-400'
                }`}
              >
                {a.status}
              </span>
            </div>
          ))}
          {agents.length === 0 && <div className="px-5 py-10 text-center text-[#4a5568] text-sm">No agent pods found</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent List View  (renamed "Terminal" → "Shell")
// ---------------------------------------------------------------------------
function AgentListView({
  agents,
  namespace,
  onShellOpen,
}: {
  agents: AgentPod[];
  namespace: string;
  onShellOpen: (pod: AgentPod) => void;
}) {
  const filtered = namespace === '_all' ? agents : agents.filter((a) => a.namespace === namespace);
  const [search, setSearch] = useState('');
  const searched = search ? filtered.filter((a) => a.name.includes(search) || a.namespace.includes(search)) : filtered;

  const statusDot = (s: string) => (s === 'Running' ? 'bg-green-400' : s === 'Pending' ? 'bg-yellow-400' : 'bg-red-400');

  return (
    <div className="bg-[#161b22] border border-[#2d3748] rounded-xl overflow-hidden">
      {/* Search */}
      <div className="px-5 py-3 border-b border-[#2d3748] flex items-center gap-3">
        <div className="flex items-center gap-2 bg-[#0d1117] rounded-lg px-3 py-1.5 flex-1 border border-transparent focus-within:border-[#4a5568] transition">
          {Icons.search}
          <input
            type="text"
            placeholder="Search pods…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-[13px] text-white placeholder-[#4a5568] outline-none w-full"
          />
        </div>
        <span className="text-[10px] text-[#4a5568] font-medium">{searched.length} pods</span>
      </div>

      {/* Table */}
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[#636e7b] text-[10px] uppercase tracking-wider">
            <th className="text-left py-3 px-5 font-semibold">Status</th>
            <th className="text-left py-3 px-5 font-semibold">Name</th>
            <th className="text-left py-3 px-5 font-semibold">Namespace</th>
            <th className="text-left py-3 px-5 font-semibold">Image</th>
            <th className="text-left py-3 px-5 font-semibold">IP</th>
            <th className="text-right py-3 px-5 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2d3748]">
          {searched.map((a) => (
            <tr key={`${a.namespace}-${a.name}`} className="hover:bg-white/[0.02] transition">
              <td className="py-3 px-5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusDot(a.status)}`} />
                  <span className="text-[#cdd9e5]">{a.status}</span>
                </div>
              </td>
              <td className="py-3 px-5 font-mono text-[#cdd9e5]">{a.name}</td>
              <td className="py-3 px-5 text-[#8b949e]">{a.namespace}</td>
              <td className="py-3 px-5 text-[#8b949e] font-mono text-xs max-w-[200px] truncate">{a.image}</td>
              <td className="py-3 px-5 text-[#8b949e] font-mono text-xs">{a.ip}</td>
              <td className="py-3 px-5 text-right">
                <button
                  onClick={() => onShellOpen(a)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 rounded-lg transition font-medium"
                >
                  {Icons.shell}
                  Shell
                </button>
              </td>
            </tr>
          ))}
          {searched.length === 0 && (
            <tr>
              <td colSpan={6} className="py-14 text-center text-[#4a5568] text-sm">
                No pods found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export function App() {
  const [view, setView] = useState<View>('dashboard');
  const [agents, setAgents] = useState<AgentPod[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [selectedNs, setSelectedNs] = useState('_all');
  const [shells, setShells] = useState<ShellSession[]>([]);
  const [activeShell, setActiveShell] = useState<string | null>(null);
  const [showDeploy, setShowDeploy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, nsRes] = await Promise.all([fetch('/api/agents'), fetch('/api/namespaces')]);
      const agentsData = await agentsRes.json();
      const nsData = await nsRes.json();
      setAgents(agentsData.agents || []);
      setNamespaces(nsData.namespaces || []);
    } catch (e) {
      console.error('Failed to fetch data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Listen for topology double-click → open shell
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { namespace, podName } = e.detail;
      openShell({ name: podName, namespace, template: '' } as AgentPod);
    };
    window.addEventListener('open-terminal', handler as EventListener);
    return () => window.removeEventListener('open-terminal', handler as EventListener);
  }, []);

  const openShell = (pod: AgentPod) => {
    const id = `${pod.namespace}-${pod.name}-${Date.now()}`;
    const session: ShellSession = {
      id,
      namespace: pod.namespace,
      podName: pod.name,
      template: pod.template || '',
    };
    setShells((prev) => [...prev, session]);
    setActiveShell(id);
  };

  const closeShell = (id: string) => {
    setShells((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeShell === id) {
        setActiveShell(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  };

  const filteredAgents = selectedNs === '_all' ? agents : agents.filter((a) => a.namespace === selectedNs);

  const viewTitles: Record<View, string> = {
    dashboard: 'Dashboard',
    agents: 'Agent Pods',
    topology: 'Topology',
    settings: 'Settings',
  };

  return (
    <div className="h-screen flex bg-[#0a0c10]">
      {/* Sidebar */}
      <Sidebar view={view} setView={setView} onDeploy={() => setShowDeploy(true)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-12 bg-[#0d1117] border-b border-[#1f2937] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-[13px] font-semibold text-white">{viewTitles[view]}</h2>
            {view !== 'settings' && (
              <NamespaceSelector namespaces={namespaces} selected={selectedNs} onChange={setSelectedNs} />
            )}
          </div>
          <span className="text-[10px] text-[#4a5568]">Last updated: {new Date().toLocaleTimeString()}</span>
        </header>

        {/* Content + Shell panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Primary content */}
          <main className="flex-1 p-5 overflow-auto relative">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3 text-[#4a5568]">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading…
                </div>
              </div>
            ) : view === 'dashboard' ? (
              <DashboardView agents={filteredAgents} namespaces={namespaces} />
            ) : view === 'agents' ? (
              <AgentListView agents={filteredAgents} namespace={selectedNs} onShellOpen={openShell} />
            ) : view === 'topology' ? (
              <div className="absolute inset-0 p-5">
                <AgentTopology />
              </div>
            ) : view === 'settings' ? (
              <AdminPanel />
            ) : null}
          </main>

          {/* Shell panel — right sidebar */}
          {shells.length > 0 && (
            <div className="w-[520px] border-l border-[#1f2937] flex flex-col bg-[#0a0c10] shrink-0">
              {/* Shell tabs */}
              <div className="flex items-center bg-[#0d1117] border-b border-[#1f2937] overflow-x-auto shrink-0">
                {shells.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveShell(s.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-mono border-r border-[#1f2937] shrink-0 group transition-all ${
                      activeShell === s.id
                        ? 'bg-[#161b22] text-blue-400'
                        : 'text-[#636e7b] hover:text-[#8b949e]'
                    }`}
                  >
                    {Icons.shell}
                    <span className="max-w-[120px] truncate">{s.podName}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        closeShell(s.id);
                      }}
                      className="text-[#4a5568] group-hover:text-red-400 ml-1 cursor-pointer"
                    >
                      ✕
                    </span>
                  </button>
                ))}
              </div>
              {/* Shell content */}
              <div className="flex-1 min-h-0">
                {shells.map((s) => (
                  <div key={s.id} className={`h-full ${activeShell === s.id ? '' : 'hidden'}`}>
                    <AgentShell
                      namespace={s.namespace}
                      podName={s.podName}
                      template={s.template}
                      onClose={() => closeShell(s.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deploy Modal */}
      {showDeploy && <DeployModal onClose={() => setShowDeploy(false)} namespace={selectedNs} onDeployed={fetchData} />}
    </div>
  );
}
