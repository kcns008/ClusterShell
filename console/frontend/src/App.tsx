import { useState, useEffect, useCallback } from 'react';
import { PodTerminal } from './components/Terminal/PodTerminal';
import { AgentTopology } from './components/Topology/AgentTopology';
import { DeployModal } from './components/DeployAgent/DeployModal';

// --- Types ---
interface AgentPod {
  name: string;
  namespace: string;
  status: string;
  image: string;
  ip: string;
  node: string;
  ports: string[];
  created: string;
}

interface Namespace {
  name: string;
  status: string;
}

type View = 'dashboard' | 'agents' | 'topology' | 'deployments' | 'settings';
type TerminalSession = { id: string; namespace: string; podName: string; };

// --- Sidebar Icons (inline SVG for zero deps) ---
const Icons = {
  dashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  agents: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  topology: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  plus: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  search: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  chevron: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
};

// --- Sidebar ---
function Sidebar({ view, setView, onDeploy }: { view: View; setView: (v: View) => void; onDeploy: () => void; }) {
  const items: { id: View; label: string; icon: JSX.Element }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
    { id: 'agents', label: 'Agent Pods', icon: Icons.agents },
    { id: 'topology', label: 'Topology', icon: Icons.topology },
  ];

  return (
    <div className="w-56 bg-[#1a1d23] border-r border-[#2d3139] flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#2d3139]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            CS
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">ClusterShell</h1>
            <p className="text-[10px] text-gray-500">Console</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-0.5 ${
              view === item.id
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        {/* Deploy button */}
        <div className="mt-4 px-1">
          <button
            onClick={onDeploy}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
          >
            {Icons.plus}
            Deploy Agent
          </button>
        </div>
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-3 border-t border-[#2d3139]">
        <button
          onClick={() => setView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
            view === 'settings' ? 'bg-white/5 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {Icons.settings}
          Settings
        </button>
        <div className="flex items-center gap-2 px-3 py-2 mt-1">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-gray-500">dev-barn · Online</span>
        </div>
      </div>
    </div>
  );
}

// --- Namespace Selector ---
function NamespaceSelector({
  namespaces, selected, onChange
}: {
  namespaces: Namespace[]; selected: string; onChange: (ns: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1d23] border border-[#2d3139] rounded-lg text-sm text-gray-300 hover:border-gray-500 transition"
      >
        <span className="text-gray-500">Project:</span>
        <span className="font-medium">{selected === '_all' ? 'All Projects' : selected}</span>
        {Icons.chevron}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-[#1a1d23] border border-[#2d3139] rounded-lg shadow-xl z-50 max-h-64 overflow-auto">
          <button
            onClick={() => { onChange('_all'); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${selected === '_all' ? 'text-blue-400' : 'text-gray-300'}`}
          >
            All Projects
          </button>
          {namespaces.map((ns) => (
            <button
              key={ns.name}
              onClick={() => { onChange(ns.name); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${selected === ns.name ? 'text-blue-400' : 'text-gray-300'}`}
            >
              {ns.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Dashboard View ---
function DashboardView({ agents, namespaces }: { agents: AgentPod[]; namespaces: Namespace[]; }) {
  const running = agents.filter(a => a.status === 'Running').length;
  const namespacesWithAgents = new Set(agents.map(a => a.namespace)).size;

  const cards = [
    { label: 'Agent Pods', value: agents.length, sub: `${running} running`, color: 'from-blue-500 to-blue-600', icon: '🤖' },
    { label: 'Namespaces', value: namespaces.length, sub: `${namespacesWithAgents} with agents`, color: 'from-purple-500 to-purple-600', icon: '📦' },
    { label: 'Running', value: running, sub: `of ${agents.length} total`, color: 'from-green-500 to-green-600', icon: '✅' },
    { label: 'Clusters', value: 1, sub: 'dev-barn (LKE)', color: 'from-orange-500 to-orange-600', icon: '🔗' },
  ];

  return (
    <div>
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-[#1a1d23] border border-[#2d3139] rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-lg`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent agents */}
      <div className="bg-[#1a1d23] border border-[#2d3139] rounded-xl">
        <div className="px-5 py-4 border-b border-[#2d3139]">
          <h3 className="text-sm font-semibold text-white">Recent Agent Pods</h3>
        </div>
        <div className="divide-y divide-[#2d3139]">
          {agents.slice(0, 5).map((agent) => (
            <div key={`${agent.namespace}-${agent.name}`} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${agent.status === 'Running' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <div>
                  <p className="text-sm text-white font-mono">{agent.name}</p>
                  <p className="text-xs text-gray-500">{agent.namespace} · {agent.image?.split('/').pop()?.split(':')[0]}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                agent.status === 'Running' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
              }`}>
                {agent.status}
              </span>
            </div>
          ))}
          {agents.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">No agent pods found</div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Agent List View ---
function AgentListView({
  agents, namespace, onTerminalOpen
}: {
  agents: AgentPod[]; namespace: string; onTerminalOpen: (pod: AgentPod) => void;
}) {
  const filtered = namespace === '_all' ? agents : agents.filter(a => a.namespace === namespace);
  const [search, setSearch] = useState('');

  const searched = search
    ? filtered.filter(a => a.name.includes(search) || a.namespace.includes(search))
    : filtered;

  const statusColor = (s: string) => {
    switch (s) {
      case 'Running': return 'bg-green-400';
      case 'Pending': return 'bg-yellow-400';
      default: return 'bg-red-400';
    }
  };

  return (
    <div className="bg-[#1a1d23] border border-[#2d3139] rounded-xl overflow-hidden">
      {/* Search bar */}
      <div className="px-5 py-3 border-b border-[#2d3139] flex items-center gap-3">
        <div className="flex items-center gap-2 bg-[#0d1117] rounded-lg px-3 py-1.5 flex-1">
          {Icons.search}
          <input
            type="text"
            placeholder="Search pods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-gray-500 outline-none w-full"
          />
        </div>
        <span className="text-xs text-gray-500">{searched.length} pods</span>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide">
            <th className="text-left py-3 px-5 font-medium">Status</th>
            <th className="text-left py-3 px-5 font-medium">Name</th>
            <th className="text-left py-3 px-5 font-medium">Namespace</th>
            <th className="text-left py-3 px-5 font-medium">Image</th>
            <th className="text-left py-3 px-5 font-medium">IP</th>
            <th className="text-right py-3 px-5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2d3139]">
          {searched.map((agent) => (
            <tr key={`${agent.namespace}-${agent.name}`} className="hover:bg-white/[0.02] transition">
              <td className="py-3 px-5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColor(agent.status)}`} />
                  <span className="text-gray-300">{agent.status}</span>
                </div>
              </td>
              <td className="py-3 px-5 font-mono text-gray-200">{agent.name}</td>
              <td className="py-3 px-5 text-gray-400">{agent.namespace}</td>
              <td className="py-3 px-5 text-gray-400 font-mono text-xs max-w-[200px] truncate">{agent.image}</td>
              <td className="py-3 px-5 text-gray-400 font-mono text-xs">{agent.ip}</td>
              <td className="py-3 px-5 text-right">
                <button
                  onClick={() => onTerminalOpen(agent)}
                  className="px-3 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-md transition font-medium"
                >
                  ⌨ Terminal
                </button>
              </td>
            </tr>
          ))}
          {searched.length === 0 && (
            <tr>
              <td colSpan={6} className="py-12 text-center text-gray-500">No pods found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- Main App ---
export function App() {
  const [view, setView] = useState<View>('dashboard');
  const [agents, setAgents] = useState<AgentPod[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [selectedNs, setSelectedNs] = useState('_all');
  const [terminals, setTerminals] = useState<TerminalSession[]>([]);
  const [showDeploy, setShowDeploy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, nsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/namespaces'),
      ]);
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

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Listen for topology double-click
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { namespace, podName } = e.detail;
      openTerminal({ name: podName, namespace } as AgentPod);
    };
    window.addEventListener('open-terminal', handler as EventListener);
    return () => window.removeEventListener('open-terminal', handler as EventListener);
  }, []);

  const openTerminal = (pod: { name: string; namespace: string }) => {
    const id = `${pod.namespace}-${pod.name}-${Date.now()}`;
    setTerminals((prev) => [...prev, { id, namespace: pod.namespace, podName: pod.name }]);
  };

  const closeTerminal = (id: string) => {
    setTerminals((prev) => prev.filter((t) => t.id !== id));
  };

  const filteredAgents = selectedNs === '_all' ? agents : agents.filter(a => a.namespace === selectedNs);

  return (
    <div className="h-screen flex bg-[#0d1117]">
      {/* Left Sidebar */}
      <Sidebar view={view} setView={setView} onDeploy={() => setShowDeploy(true)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with namespace selector */}
        <header className="h-14 bg-[#13161b] border-b border-[#2d3139] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-white capitalize">{view}</h2>
            <NamespaceSelector namespaces={namespaces} selected={selectedNs} onChange={setSelectedNs} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Primary view */}
          <main className="flex-1 p-6 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>
            ) : view === 'dashboard' ? (
              <DashboardView agents={filteredAgents} namespaces={namespaces} />
            ) : view === 'agents' ? (
              <AgentListView agents={filteredAgents} namespace={selectedNs} onTerminalOpen={openTerminal} />
            ) : view === 'topology' ? (
              <div className="h-full">
                <div className="h-[calc(100%-20px)]">
                  <AgentTopology />
                </div>
              </div>
            ) : view === 'settings' ? (
              <div className="bg-[#1a1d23] border border-[#2d3139] rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Settings</h3>
                <p className="text-gray-400 text-sm">Console configuration coming soon.</p>
              </div>
            ) : null}
          </main>

          {/* Terminal panel */}
          {terminals.length > 0 && (
            <div className="w-[480px] border-l border-[#2d3139] flex flex-col bg-[#0d1117] shrink-0">
              {/* Terminal tabs */}
              <div className="flex items-center bg-[#13161b] border-b border-[#2d3139] overflow-x-auto">
                {terminals.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => setTerminals(prev => prev.filter(x => x.id === terminals[i]?.id))}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-gray-400 hover:text-white border-r border-[#2d3139] shrink-0 group"
                  >
                    <span>⌨ {t.podName.slice(0, 20)}</span>
                    <span className="text-gray-600 group-hover:text-red-400 ml-1">✕</span>
                  </button>
                ))}
              </div>
              {/* Terminal content */}
              <div className="flex-1">
                {terminals.map((t) => (
                  <PodTerminal
                    key={t.id}
                    namespace={t.namespace}
                    podName={t.podName}
                    onClose={() => closeTerminal(t.id)}
                  />
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
