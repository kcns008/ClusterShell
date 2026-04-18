import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  category: 'agent' | 'skill' | 'plugin';
  tags: string[];
  enabled: boolean;
  repo: string;
}

interface SCMConfig {
  provider: 'github' | 'gitlab';
  orgOrGroup: string;
  baseURL: string;
  tokenSet: boolean;
  allowedRepos: string;
}

interface DeployRequest {
  template: string;
  name: string;
  namespace: string;
  gitRepo: string;
  skills: string[];
  plugins: string[];
}

interface DeployModalProps {
  onClose: () => void;
  namespace: string;
  onDeployed: () => void;
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------
const Steps = ['Select Agent', 'Add-ons & Config', 'Review'] as const;
type Step = 0 | 1 | 2;

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {Steps.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                i < current
                  ? 'bg-blue-500 text-white'
                  : i === current
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400/40'
                  : 'bg-[#2d3748] text-[#636e7b]'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium ${i === current ? 'text-blue-400' : 'text-[#636e7b]'}`}>
              {label}
            </span>
          </div>
          {i < Steps.length - 1 && (
            <div className={`w-16 h-px mx-2 mb-4 transition-all ${i < current ? 'bg-blue-500' : 'bg-[#2d3748]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Select Agent
// ---------------------------------------------------------------------------
function SelectAgentStep({
  catalog,
  selected,
  onSelect,
}: {
  catalog: CatalogEntry[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const agents = catalog.filter((e) => e.enabled && e.category === 'agent');

  return (
    <div>
      <p className="text-xs text-[#8b949e] mb-3">Select an agent to deploy <span className="text-red-400">*</span></p>
      <div className="grid grid-cols-2 gap-2 max-h-[48vh] overflow-y-auto pr-1">
        {agents.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onSelect(entry.id)}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              selected === entry.id
                ? 'border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/10'
                : 'border-[#2d3748] hover:border-[#4a5568] bg-[#161b22] hover:bg-[#1c2128]'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5">{entry.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-sm font-semibold truncate ${selected === entry.id ? 'text-blue-400' : 'text-white'}`}>
                    {entry.name}
                  </p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-400 shrink-0">
                    Agent
                  </span>
                </div>
                <p className="text-xs text-[#8b949e] line-clamp-2 leading-relaxed">{entry.description}</p>
                {entry.tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {entry.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-px rounded bg-[#1c2128] border border-[#2d3748] text-[#636e7b]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
        {agents.length === 0 && (
          <div className="col-span-2 py-12 text-center text-[#4a5568] text-sm">
            No agents available.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Configure
// ---------------------------------------------------------------------------
function ConfigureStep({
  req,
  setReq,
  scm,
  catalog,
}: {
  req: DeployRequest;
  setReq: (r: DeployRequest) => void;
  scm: SCMConfig;
  catalog: CatalogEntry[];
}) {
  const entry = catalog.find((e) => e.id === req.template);
  const skills = catalog.filter((e) => e.category === 'skill' && e.enabled);
  const plugins = catalog.filter((e) => e.category === 'plugin' && e.enabled);

  const toggleSkill = (id: string) => {
    const next = req.skills.includes(id) ? req.skills.filter((s) => s !== id) : [...req.skills, id];
    setReq({ ...req, skills: next });
  };
  const togglePlugin = (id: string) => {
    const next = req.plugins.includes(id) ? req.plugins.filter((p) => p !== id) : [...req.plugins, id];
    setReq({ ...req, plugins: next });
  };

  return (
    <div className="space-y-5 max-h-[52vh] overflow-y-auto pr-1">
      {entry && (
        <div className="flex items-center gap-3 p-3 bg-[#161b22] border border-[#2d3748] rounded-xl">
          <span className="text-2xl">{entry.icon}</span>
          <div>
            <p className="text-sm font-semibold text-white">{entry.name}</p>
            <p className="text-xs text-[#8b949e]">{entry.image || 'No image'}</p>
          </div>
        </div>
      )}

      {/* Optional Skills */}
      {skills.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1">
            Skills
            <span className="ml-1 text-[#4a5568] font-normal">(optional)</span>
          </label>
          <p className="text-[10px] text-[#4a5568] mb-2">Add skills to extend the agent's capabilities</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleSkill(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  req.skills.includes(s.id)
                    ? 'border-blue-500 bg-blue-600/10 text-blue-400'
                    : 'border-[#2d3748] bg-[#161b22] text-[#8b949e] hover:border-[#4a5568] hover:text-white'
                }`}
              >
                <span>{s.icon}</span>{s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Optional Plugins */}
      {plugins.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1">
            Plugins
            <span className="ml-1 text-[#4a5568] font-normal">(optional)</span>
          </label>
          <p className="text-[10px] text-[#4a5568] mb-2">Add plugins for additional integrations</p>
          <div className="flex flex-wrap gap-2">
            {plugins.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePlugin(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  req.plugins.includes(p.id)
                    ? 'border-purple-500 bg-purple-600/10 text-purple-400'
                    : 'border-[#2d3748] bg-[#161b22] text-[#8b949e] hover:border-[#4a5568] hover:text-white'
                }`}
              >
                <span>{p.icon}</span>{p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-[#2d3748]" />

      {/* Configuration fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Agent Name *</label>
          <input
            type="text"
            value={req.name}
            onChange={(e) => setReq({ ...req, name: e.target.value })}
            placeholder="my-agent"
            className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Namespace *</label>
          <input
            type="text"
            value={req.namespace}
            onChange={(e) => setReq({ ...req, namespace: e.target.value })}
            placeholder="default"
            className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#8b949e] mb-1.5">
          Git Repository
          <span className="ml-1 text-[#4a5568] font-normal">(optional)</span>
        </label>
        <div className="flex items-center bg-[#0d1117] border border-[#2d3748] focus-within:border-blue-500 rounded-lg overflow-hidden transition">
          <span className="text-xs text-[#4a5568] font-mono px-3 border-r border-[#2d3748] py-2 whitespace-nowrap">
            {scm.provider === 'gitlab' ? 'gitlab' : 'github'}
          </span>
          <input
            type="text"
            value={req.gitRepo}
            onChange={(e) => setReq({ ...req, gitRepo: e.target.value })}
            placeholder="org/repo-name"
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none font-mono"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Review
// ---------------------------------------------------------------------------
function ReviewStep({ req, catalog }: { req: DeployRequest; catalog: CatalogEntry[] }) {
  const entry = catalog.find((e) => e.id === req.template);
  const selectedSkills = catalog.filter((e) => req.skills.includes(e.id));
  const selectedPlugins = catalog.filter((e) => req.plugins.includes(e.id));
  return (
    <div className="space-y-4">
      <div className="bg-[#0d1117] border border-[#2d3748] rounded-xl overflow-hidden">
        {([
          ['Agent', `${entry?.icon ?? ''} ${entry?.name ?? req.template}`],
          ['Pod Name', req.name],
          ['Namespace', req.namespace],
          ['Image', entry?.image ?? '—'],
          ['Git Repo', req.gitRepo || '—'],
          ['Skills', selectedSkills.map((s) => s.name).join(', ') || 'none'],
          ['Plugins', selectedPlugins.map((p) => p.name).join(', ') || 'none'],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="flex items-start gap-4 px-4 py-2.5 border-b border-[#2d3748] last:border-0">
            <span className="text-xs font-medium text-[#8b949e] w-20 shrink-0 pt-px">{label}</span>
            <span className="text-sm text-white font-mono leading-relaxed">{value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#636e7b] leading-relaxed">
        A Kubernetes pod will be created. Click <strong className="text-[#8b949e]">Shell</strong> in
        Agent Pods once it enters Running state to open it directly.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------
export function DeployModal({ onClose, namespace, onDeployed }: DeployModalProps) {
  const [step, setStep] = useState<Step>(0);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [scm, setSCM] = useState<SCMConfig>({ provider: 'github', orgOrGroup: '', baseURL: 'https://github.com', tokenSet: false, allowedRepos: '' });
  const [req, setReq] = useState<DeployRequest>({
    template: '',
    name: '',
    namespace: namespace === '_all' ? 'default' : namespace,
    gitRepo: '',
    skills: [],
    plugins: [],
  });
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/catalog').then((r) => r.json()),
      fetch('/api/admin/scm').then((r) => r.json()),
    ]).then(([cat, scmData]) => {
      setCatalog(cat.catalog ?? []);
      setSCM(scmData);
    }).catch(() => {});
  }, []);

  const canAdvance = () => {
    if (step === 0) return !!req.template;
    if (step === 1) return opencodereq.name && !!req.namespace;
    return true;
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setError('');
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Deploy failed');
      }
      onDeployed();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#13161b] border border-[#2d3748] rounded-2xl w-[720px] max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-[#2d3748] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Deploy Agent</h2>
            <p className="text-xs text-[#8b949e] mt-0.5">Launch a sandboxed AI agent or blank shell</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#636e7b] hover:text-white hover:bg-[#2d3748] transition"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-hidden px-6 py-5">
          <StepIndicator current={step} />
          {step === 0 && <SelectAgentStep catalog={catalog} selected={req.template} onSelect={(id) => setReq((r) => ({ ...r, template: id, name: id }))} />}
          {step === 1 && <ConfigureStep req={req} setReq={setReq} scm={scm} catalog={catalog} />}
          {step === 2 && <ReviewStep req={req} catalog={catalog} />}
        </div>
        <div className="px-6 py-4 border-t border-[#2d3748] flex items-center justify-between shrink-0">
          <button
            onClick={step === 0 ? onClose : () => setStep((s) => (s - 1) as Step)}
            className="px-4 py-2 text-sm text-[#8b949e] hover:text-white border border-[#2d3748] hover:border-[#4a5568] rounded-lg transition font-medium"
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          {step < 2 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!canAdvance()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[#2d3748] disabled:text-[#636e7b] disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
            >
              {deploying && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
              {deploying ? 'Deploying…' : '🚀 Deploy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
