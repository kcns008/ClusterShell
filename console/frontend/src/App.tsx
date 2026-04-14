import { useState, useEffect } from 'react';
import { AgentList } from './components/AgentList/AgentList';
import { AgentTopology } from './components/Topology/AgentTopology';
import { PodTerminal } from './components/Terminal/PodTerminal';

type View = 'agents' | 'topology';

interface TerminalSession {
  id: string;
  namespace: string;
  podName: string;
}

export function App() {
  const [view, setView] = useState<View>('agents');
  const [terminals, setTerminals] = useState<TerminalSession[]>([]);

  // Listen for topology double-click to open terminal
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { namespace, podName } = e.detail;
      openTerminal({ name: podName, namespace } as any);
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

  return (
    <div className="h-screen flex flex-col">
      {/* Top navbar */}
      <nav className="flex items-center justify-between px-6 py-3 bg-[#161b22] border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-xl">🐚</span>
          <h1 className="text-lg font-bold text-white">ClusterShell</h1>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Console</span>
        </div>

        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setView('agents')}
            className={`px-4 py-1.5 text-sm rounded-md transition ${
              view === 'agents' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            🤖 Agents
          </button>
          <button
            onClick={() => setView('topology')}
            className={`px-4 py-1.5 text-sm rounded-md transition ${
              view === 'topology' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            🔗 Topology
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">dev-barn</span>
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Primary view */}
        <div className="flex-1 p-6 overflow-auto">
          {view === 'agents' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">Agent Pods</h2>
                  <p className="text-sm text-gray-500 mt-1">Manage and connect to your AI agent deployments</p>
                </div>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition">
                  + Deploy Agent
                </button>
              </div>
              <div className="bg-[#161b22] rounded-lg border border-gray-700">
                <AgentList onTerminalOpen={openTerminal} />
              </div>
            </div>
          )}
          {view === 'topology' && (
            <div className="h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Network Topology</h2>
                  <p className="text-sm text-gray-500 mt-1">Visual map of agent deployments and connections</p>
                </div>
                <button
                  onClick={() => {
                    // Refresh topology
                    window.dispatchEvent(new CustomEvent('refresh-topology'));
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  ↻ Refresh
                </button>
              </div>
              <div className="h-[calc(100%-60px)]">
                <AgentTopology />
              </div>
            </div>
          )}
        </div>

        {/* Terminal panel (right side, resizable) */}
        {terminals.length > 0 && (
          <div className="w-[500px] border-l border-gray-700 flex flex-col bg-[#0d1117]">
            {/* Terminal tabs */}
            <div className="flex items-center bg-[#161b22] border-b border-gray-700">
              {terminals.map((t) => (
                <button
                  key={t.id}
                  className="px-4 py-2 text-xs font-mono text-gray-400 hover:text-white border-r border-gray-700"
                >
                  {t.podName}
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
      </main>
    </div>
  );
}
