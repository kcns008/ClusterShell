import { useState, useEffect } from 'react';
import { PodTerminal } from '../Terminal/PodTerminal';
import { AgentTopology } from '../Topology/AgentTopology';

interface AgentPod {
  name: string;
  namespace: string;
  status: string;
  image: string;
  created: string;
  ip: string;
  node: string;
  ports: string[];
}

/**
 * Agent list with status, actions, and quick terminal access.
 */
export function AgentList({ onTerminalOpen }: { onTerminalOpen: (pod: AgentPod) => void }) {
  const [agents, setAgents] = useState<AgentPod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => { setAgents(data.agents || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    switch (s) {
      case 'Running': return 'text-green-400';
      case 'Pending': return 'text-yellow-400';
      case 'Error': case 'CrashLoopBackOff': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const statusDot = (s: string) => {
    switch (s) {
      case 'Running': return 'bg-green-400';
      case 'Pending': return 'bg-yellow-400';
      case 'Error': case 'CrashLoopBackOff': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  if (loading) {
    return <div className="text-gray-400 text-center py-12">Loading agents...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="text-left py-3 px-4 font-medium">Status</th>
            <th className="text-left py-3 px-4 font-medium">Agent</th>
            <th className="text-left py-3 px-4 font-medium">Namespace</th>
            <th className="text-left py-3 px-4 font-medium">Image</th>
            <th className="text-left py-3 px-4 font-medium">IP</th>
            <th className="text-left py-3 px-4 font-medium">Node</th>
            <th className="text-left py-3 px-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={`${agent.namespace}-${agent.name}`} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusDot(agent.status)}`} />
                  <span className={statusColor(agent.status)}>{agent.status}</span>
                </div>
              </td>
              <td className="py-3 px-4 font-mono text-gray-200">{agent.name}</td>
              <td className="py-3 px-4 text-gray-400">{agent.namespace}</td>
              <td className="py-3 px-4 text-gray-400 font-mono text-xs">{agent.image}</td>
              <td className="py-3 px-4 text-gray-400 font-mono text-xs">{agent.ip}</td>
              <td className="py-3 px-4 text-gray-400 text-xs">{agent.node}</td>
              <td className="py-3 px-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => onTerminalOpen(agent)}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition"
                  >
                    ⌨ Terminal
                  </button>
                  <button className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition">
                    📋 Logs
                  </button>
                  <button className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition">
                    🔄 Restart
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {agents.length === 0 && (
            <tr>
              <td colSpan={7} className="py-12 text-center text-gray-500">
                No agent pods found. Deploy one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
