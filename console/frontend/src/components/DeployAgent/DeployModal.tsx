import { useState } from 'react';

interface DeployModalProps {
  onClose: () => void;
  namespace: string;
  onDeployed: () => void;
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  repo: string;
  category: string;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'copilot',
    name: 'GitHub Copilot CLI',
    description: 'AI-powered CLI assistant with code suggestions, shell commands, and git assistance',
    icon: '🐙',
    image: 'alpine:3.21',
    repo: 'github-copilot',
    category: 'Code Assistant',
  },
  {
    id: 'opencode',
    name: 'OpenCode / Crush',
    description: 'Terminal-based AI coding agent with multi-provider support and LSP integration',
    icon: '⚡',
    image: 'alpine:3.21',
    repo: 'opencode',
    category: 'Code Assistant',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic\'s agentic coding tool — edit files, run commands, and manage git repos',
    icon: '🧠',
    image: 'node:22-alpine',
    repo: 'claude-code',
    category: 'Code Assistant',
  },
  {
    id: 'aider',
    name: 'Aider',
    description: 'AI pair programming in your terminal — works with GPT-4, Claude, and local models',
    icon: '🤝',
    image: 'python:3.12-alpine',
    repo: 'aider',
    category: 'Code Assistant',
  },
  {
    id: 'cline',
    name: 'Cline (VS Code)',
    description: 'Autonomous AI coding agent that integrates with VS Code and multiple LLM providers',
    icon: '🎯',
    image: 'node:22-alpine',
    repo: 'cline',
    category: 'IDE Agent',
  },
  {
    id: 'devika',
    name: 'Devika',
    description: 'Agentic AI software engineer — plans, researches, and writes code autonomously',
    icon: '👩‍💻',
    image: 'python:3.12-alpine',
    repo: 'devika',
    category: 'AI Engineer',
  },
];

const CATEGORIES = [...new Set(AGENT_TEMPLATES.map(t => t.category))];

export function DeployModal({ onClose, namespace, onDeployed }: DeployModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [targetNs, setTargetNs] = useState(namespace === '_all' ? 'default' : namespace);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState('');

  const template = AGENT_TEMPLATES.find(t => t.id === selected);

  const handleDeploy = async () => {
    if (!template || !agentName) return;
    setDeploying(true);
    setError('');

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: template.id,
          name: agentName,
          namespace: targetNs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Deploy failed');
      }

      onDeployed();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1a1d23] border border-[#2d3139] rounded-2xl w-[680px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2d3139] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Deploy Agent</h2>
            <p className="text-sm text-gray-500 mt-0.5">Choose an AI agent template to deploy</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">✕</button>
        </div>

        {/* Templates */}
        <div className="px-6 py-4 overflow-y-auto max-h-[45vh]">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</h3>
              <div className="grid grid-cols-2 gap-2">
                {AGENT_TEMPLATES.filter(t => t.category === cat).map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => { setSelected(tmpl.id); setAgentName(tmpl.id); }}
                    className={`text-left p-3 rounded-xl border transition ${
                      selected === tmpl.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[#2d3139] hover:border-gray-500 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{tmpl.icon}</span>
                      <div>
                        <p className={`text-sm font-medium ${selected === tmpl.id ? 'text-blue-400' : 'text-white'}`}>
                          {tmpl.name}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{tmpl.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Configure & Deploy */}
        {template && (
          <div className="px-6 py-4 border-t border-[#2d3139] bg-[#13161b]">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Agent Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#2d3139] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  placeholder="my-agent"
                />
              </div>
              <div className="w-48">
                <label className="text-xs text-gray-500 mb-1 block">Namespace</label>
                <input
                  type="text"
                  value={targetNs}
                  onChange={(e) => setTargetNs(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#2d3139] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleDeploy}
                disabled={deploying || !agentName}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
              >
                {deploying ? 'Deploying...' : 'Deploy'}
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
