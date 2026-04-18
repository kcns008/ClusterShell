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
  portForward: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
// Dashboard SVG Icons (minimalistic, icon-first design)
// ---------------------------------------------------------------------------
const DashIcons = {
  pods: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  ),
  namespace: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  running: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  cluster: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
    </svg>
  ),
  cpu: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
  ),
  network: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Dashboard View — Minimalistic Icon-Based Design
// ---------------------------------------------------------------------------
function DashboardView({
  agents,
  namespaces,
  onNavigate,
}: {
  agents: AgentPod[];
  namespaces: Namespace[];
  onNavigate: (view: View) => void;
}) {
  const running = agents.filter((a) => a.status === 'Running').length;
  const pending = agents.filter((a) => a.status === 'Pending').length;
  const failed = agents.filter((a) => a.status !== 'Running' && a.status !== 'Pending').length;
  const namespacesWithAgents = new Set(agents.map((a) => a.namespace)).size;
  const uniqueImages = new Set(agents.map((a) => a.image)).size;

  const stats = [
    { label: 'Pods', value: agents.length, icon: DashIcons.pods, color: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
    { label: 'Running', value: running, icon: DashIcons.running, color: 'text-green-400', bg: 'bg-green-500/10', ring: 'ring-green-500/20' },
    { label: 'Namespaces', value: namespacesWithAgents, icon: DashIcons.namespace, color: 'text-purple-400', bg: 'bg-purple-500/10', ring: 'ring-purple-500/20' },
    { label: 'Images', value: uniqueImages, icon: DashIcons.cpu, color: 'text-cyan-400', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/20' },
    { label: 'Services', value: namespaces.length, icon: DashIcons.network, color: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
    { label: 'Clusters', value: 1, icon: DashIcons.cluster, color: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-500/20' },
  ];

  return (
    <div className="space-y-5">
      {/* Stat grid — icon-centric cards */}
      <div className="grid grid-cols-6 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`${s.bg} ring-1 ${s.ring} rounded-xl p-4 flex flex-col items-center gap-2 hover:scale-[1.03] transition-transform cursor-default`}
          >
            <div className={s.color}>{s.icon}</div>
            <span className="text-2xl font-bold text-white">{s.value}</span>
            <span className="text-[10px] font-medium text-[#8b949e] uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Health ring + quick actions row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Health ring */}
        <div className="bg-[#161b22] border border-[#2d3748] rounded-xl p-5 flex flex-col items-center justify-center">
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1f2937" strokeWidth="3" />
              {agents.length > 0 && (
                <>
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3"
                    strokeDasharray={`${(running / agents.length) * 100} ${100 - (running / agents.length) * 100}`} strokeLinecap="round" />
                  {pending > 0 && (
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="3"
                      strokeDasharray={`${(pending / agents.length) * 100} ${100 - (pending / agents.length) * 100}`}
                      strokeDashoffset={`${-((running / agents.length) * 100)}`} strokeLinecap="round" />
                  )}
                  {failed > 0 && (
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" strokeWidth="3"
                      strokeDasharray={`${(failed / agents.length) * 100} ${100 - (failed / agents.length) * 100}`}
                      strokeDashoffset={`${-(((running + pending) / agents.length) * 100)}`} strokeLinecap="round" />
                  )}
                </>
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-white">{agents.length > 0 ? Math.round((running / agents.length) * 100) : 0}%</span>
              <span className="text-[9px] text-[#636e7b] uppercase">Healthy</span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" />Running {running}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />Pending {pending}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Failed {failed}</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-[#161b22] border border-[#2d3748] rounded-xl p-5">
          <h3 className="text-[10px] font-semibold text-[#636e7b] uppercase tracking-widest mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Agent Pods', icon: DashIcons.pods, action: () => onNavigate('agents') },
              { label: 'Topology', icon: DashIcons.network, action: () => onNavigate('topology') },
              { label: 'Settings', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ), action: () => onNavigate('settings') },
              { label: 'Cluster Info', icon: DashIcons.cluster, action: () => onNavigate('settings') },
            ].map((a) => (
              <button
                key={a.label}
                onClick={a.action}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-[#2d3748] hover:border-[#4a5568] transition text-[#8b949e] hover:text-white"
              >
                {a.icon}
                <span className="text-[10px] font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Namespace breakdown */}
        <div className="bg-[#161b22] border border-[#2d3748] rounded-xl p-5">
          <h3 className="text-[10px] font-semibold text-[#636e7b] uppercase tracking-widest mb-3">By Namespace</h3>
          <div className="space-y-2">
            {Object.entries(
              agents.reduce<Record<string, number>>((acc, a) => {
                acc[a.namespace] = (acc[a.namespace] || 0) + 1;
                return acc;
              }, {})
            ).sort(([, a], [, b]) => b - a).slice(0, 5).map(([ns, count]) => (
              <div key={ns} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-purple-500/15 flex items-center justify-center">
                  {DashIcons.namespace}
                </div>
                <span className="text-xs text-[#cdd9e5] flex-1 font-mono truncate">{ns}</span>
                <span className="text-xs font-semibold text-white">{count}</span>
                <div className="w-16 h-1.5 bg-[#2d3748] rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(count / agents.length) * 100}%` }} />
                </div>
              </div>
            ))}
            {agents.length === 0 && <p className="text-xs text-[#4a5568] text-center py-4">No agents deployed</p>}
          </div>
        </div>
      </div>

      {/* Recent agents — compact list */}
      <div className="bg-[#161b22] border border-[#2d3748] rounded-xl">
        <div className="px-5 py-3 border-b border-[#2d3748] flex items-center justify-between">
          <h3 className="text-[10px] font-semibold text-[#636e7b] uppercase tracking-widest">Recent Agent Pods</h3>
          <button onClick={() => onNavigate('agents')} className="text-[10px] text-blue-400 hover:text-blue-300 transition font-medium">View all</button>
        </div>
        <div className="divide-y divide-[#2d3748]">
          {agents.slice(0, 5).map((a) => (
            <div key={`${a.namespace}-${a.name}`} className="px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.015] transition">
              <div className={`w-2 h-2 rounded-full shrink-0 ${a.status === 'Running' ? 'bg-green-400' : a.status === 'Pending' ? 'bg-yellow-400' : 'bg-red-400'}`} />
              <span className="text-xs text-white font-mono flex-1 truncate">{a.name}</span>
              <span className="text-[10px] text-[#4a5568] font-mono">{a.namespace}</span>
              <span className="text-[10px] text-[#4a5568] font-mono truncate max-w-[120px]">{a.image?.split('/').pop()}</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  a.status === 'Running' ? 'bg-green-600/10 text-green-400' : a.status === 'Pending' ? 'bg-yellow-600/10 text-yellow-400' : 'bg-red-600/10 text-red-400'
                }`}
              >
                {a.status}
              </span>
            </div>
          ))}
          {agents.length === 0 && <div className="px-5 py-8 text-center text-[#4a5568] text-[11px]">No agent pods found</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Port Forward Modal — shows kubectl port-forward command
// ---------------------------------------------------------------------------
function PortForwardModal({
  pod,
  onClose,
}: {
  pod: AgentPod;
  onClose: () => void;
}) {
  const [localPort, setLocalPort] = useState('7681');
  const [copied, setCopied] = useState(false);
  const remotePort = pod.ports?.[0]?.split('/')[0] || '7681';
  const cmd = `kubectl port-forward pod/${pod.name} ${localPort}:${remotePort} -n ${pod.namespace}`;

  const copy = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#13161b] border border-[#2d3748] rounded-2xl w-[520px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#2d3748] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              {Icons.portForward}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Port Forward</h3>
              <p className="text-[10px] text-[#636e7b]">Connect from local terminal to pod</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#636e7b] hover:text-white text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-[#161b22] border border-[#2d3748] rounded-xl">
            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-white font-mono truncate">{pod.name}</p>
              <p className="text-[10px] text-[#636e7b]">{pod.namespace} · {pod.ip}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Local Port</label>
              <input
                type="text"
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Remote Port</label>
              <input
                type="text"
                value={remotePort}
                disabled
                className="w-full bg-[#0d1117] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-[#636e7b] outline-none font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Command</label>
            <div className="flex items-center bg-[#0d1117] border border-[#2d3748] rounded-lg overflow-hidden">
              <code className="flex-1 px-3 py-2.5 text-xs text-[#cdd9e5] font-mono overflow-x-auto whitespace-nowrap">{cmd}</code>
              <button
                onClick={copy}
                className="px-3 py-2.5 text-xs text-[#8b949e] hover:text-white hover:bg-white/5 transition border-l border-[#2d3748] shrink-0"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-[#4a5568] leading-relaxed">
            Run this command in your local terminal to forward traffic from <span className="font-mono text-[#8b949e]">localhost:{localPort}</span> to the pod.
            Then access the agent at <span className="font-mono text-blue-400">http://localhost:{localPort}</span>
          </p>
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
  const [portForwardPod, setPortForwardPod] = useState<AgentPod | null>(null);
  const searched = search ? filtered.filter((a) => a.name.includes(search) || a.namespace.includes(search)) : filtered;

  const statusDot = (s: string) => (s === 'Running' ? 'bg-green-400' : s === 'Pending' ? 'bg-yellow-400' : 'bg-red-400');

  return (
    <>
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
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => onShellOpen(a)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 rounded-lg transition font-medium"
                      title="Open shell"
                    >
                      {Icons.shell}
                      Shell
                    </button>
                    <button
                      onClick={() => setPortForwardPod(a)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600/15 text-amber-400 hover:bg-amber-600/25 rounded-lg transition font-medium"
                      title="Port forward to local terminal"
                    >
                      {Icons.portForward}
                      Forward
                    </button>
                  </div>
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
      {portForwardPod && <PortForwardModal pod={portForwardPod} onClose={() => setPortForwardPod(null)} />}
    </>
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
              <DashboardView agents={filteredAgents} namespaces={namespaces} onNavigate={setView} />
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
