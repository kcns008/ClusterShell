import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types (mirror backend admin API)
// ---------------------------------------------------------------------------
interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'developer' | 'viewer';
  namespace: string;
  policies: string[];
  skills: string[];
  agents: string[];
}

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  scope: 'sandbox' | 'user' | 'namespace';
  yamlSpec: string;
}

interface SCMConfig {
  provider: 'github' | 'gitlab';
  orgOrGroup: string;
  baseURL: string;
  tokenSet: boolean;
  allowedRepos: string;
}

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

type AdminTab = 'users' | 'policies' | 'catalog' | 'scm';

// ---------------------------------------------------------------------------
// Shared UI bits
// ---------------------------------------------------------------------------
function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-[#2d3748] text-[#8b949e]',
    blue: 'bg-blue-600/15 text-blue-400',
    green: 'bg-green-600/15 text-green-400',
    amber: 'bg-amber-600/15 text-amber-400',
    purple: 'bg-purple-600/15 text-purple-400',
    red: 'bg-red-600/15 text-red-400',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

function SectionCard({ title, subtitle, action, children }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#161b22] border border-[#2d3748] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2d3748] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-[#636e7b] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Users & Access Control
// ---------------------------------------------------------------------------
function UsersTab({ users, policies, catalog, onRefresh }: {
  users: AdminUser[];
  policies: PolicyTemplate[];
  catalog: CatalogEntry[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const roleBadge = (role: string) => {
    const c = role === 'admin' ? 'purple' : role === 'developer' ? 'blue' : 'gray';
    return <Badge label={role} color={c} />;
  };

  const saveUser = async (u: AdminUser) => {
    await fetch('/api/admin/users', {
      method: u.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(u),
    });
    setEditing(null);
    onRefresh();
  };

  const deleteUser = async (id: string) => {
    await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Users & Access Control"
        subtitle="Manage who can deploy which agents and access which namespaces"
        action={
          <button
            onClick={() => setEditing({ id: `u${Date.now()}`, email: '', role: 'developer', namespace: 'default', policies: [], skills: [], agents: [] })}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
          >
            + Add User
          </button>
        }
      >
        <div className="divide-y divide-[#2d3748]">
          {users.map((u) => (
            <div key={u.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.015] transition">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {u.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{u.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {roleBadge(u.role)}
                    <span className="text-[10px] text-[#636e7b]">ns: {u.namespace}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right text-[10px] text-[#636e7b]">
                  <div>{u.agents.length === 1 && u.agents[0] === '*' ? 'all agents' : `${u.agents.length} agents`}</div>
                  <div>{u.policies.length} policies · {u.skills.length === 1 && u.skills[0] === '*' ? 'all skills' : `${u.skills.length} skills`}</div>
                </div>
                <button
                  onClick={() => setEditing(u)}
                  className="text-xs px-2 py-1 text-[#8b949e] hover:text-white hover:bg-[#2d3748] rounded transition"
                >
                  Edit
                </button>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => deleteUser(u.id)}
                    className="text-xs px-2 py-1 text-red-400/60 hover:text-red-400 hover:bg-red-600/10 rounded transition"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="px-5 py-8 text-center text-[#4a5568] text-sm">No users configured</div>
          )}
        </div>
      </SectionCard>

      {/* Edit user inline modal */}
      {editing && (
        <UserEditModal
          user={editing}
          policies={policies}
          catalog={catalog}
          onSave={saveUser}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function UserEditModal({ user, policies, catalog, onSave, onClose }: {
  user: AdminUser;
  policies: PolicyTemplate[];
  catalog: CatalogEntry[];
  onSave: (u: AdminUser) => void;
  onClose: () => void;
}) {
  const [u, setU] = useState(user);
  const agents = catalog.filter((e) => e.category === 'agent');
  const skills = catalog.filter((e) => e.category === 'skill');

  const toggleItem = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#13161b] border border-[#2d3748] rounded-2xl w-[560px] max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#2d3748] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Edit User Access</h3>
          <button onClick={onClose} className="text-[#636e7b] hover:text-white text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#8b949e] mb-1">Email</label>
              <input
                type="email"
                value={u.email}
                onChange={(e) => setU({ ...u, email: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8b949e] mb-1">Role</label>
              <select
                value={u.role}
                onChange={(e) => setU({ ...u, role: e.target.value as AdminUser['role'] })}
                className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
              >
                <option value="admin">Admin</option>
                <option value="developer">Developer</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-1">Namespace</label>
            <input
              type="text"
              value={u.namespace}
              onChange={(e) => setU({ ...u, namespace: e.target.value })}
              placeholder="* for all"
              className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
            />
          </div>

          {/* Policy assignment */}
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-2">Policies</label>
            <div className="flex flex-wrap gap-2">
              {policies.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setU({ ...u, policies: toggleItem(u.policies, p.id) })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    u.policies.includes(p.id)
                      ? 'border-green-500 bg-green-600/10 text-green-400'
                      : 'border-[#2d3748] text-[#8b949e] hover:border-[#4a5568]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Agent access */}
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-2">Allowed Agents</label>
            <div className="flex flex-wrap gap-2">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setU({ ...u, agents: toggleItem(u.agents, a.id) })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    u.agents.includes(a.id) || (u.agents.length === 1 && u.agents[0] === '*')
                      ? 'border-blue-500 bg-blue-600/10 text-blue-400'
                      : 'border-[#2d3748] text-[#8b949e] hover:border-[#4a5568]'
                  }`}
                >
                  <span>{a.icon}</span> {a.name}
                </button>
              ))}
            </div>
          </div>

          {/* Skill access */}
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-2">Allowed Skills</label>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setU({ ...u, skills: toggleItem(u.skills, s.id) })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    u.skills.includes(s.id) || (u.skills.length === 1 && u.skills[0] === '*')
                      ? 'border-purple-500 bg-purple-600/10 text-purple-400'
                      : 'border-[#2d3748] text-[#8b949e] hover:border-[#4a5568]'
                  }`}
                >
                  <span>{s.icon}</span> {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#2d3748] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#8b949e] border border-[#2d3748] rounded-lg hover:text-white transition">Cancel</button>
          <button
            onClick={() => onSave(u)}
            disabled={!u.email}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Policy Management
// ---------------------------------------------------------------------------
function PoliciesTab({ policies, onRefresh }: { policies: PolicyTemplate[]; onRefresh: () => void }) {
  const [editing, setEditing] = useState<PolicyTemplate | null>(null);

  const savePolicy = async (p: PolicyTemplate) => {
    await fetch('/api/admin/policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    setEditing(null);
    onRefresh();
  };

  const deletePolicy = async (id: string) => {
    await fetch(`/api/admin/policies?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    onRefresh();
  };

  const scopeColor = (s: string) => s === 'sandbox' ? 'blue' : s === 'user' ? 'purple' : 'amber';

  return (
    <div className="space-y-4">
      <SectionCard
        title="Security Policies"
        subtitle="Define network, filesystem, and process constraints for sandboxes"
        action={
          <button
            onClick={() => setEditing({ id: `p${Date.now()}`, name: '', description: '', scope: 'sandbox', yamlSpec: 'network_policies:\n  - host: "*"\n    action: allow\nprocess:\n  drop_privileges: true\n' })}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
          >
            + New Policy
          </button>
        }
      >
        <div className="divide-y divide-[#2d3748]">
          {policies.map((p) => (
            <div key={p.id} className="px-5 py-3.5 flex items-start justify-between hover:bg-white/[0.015] transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <Badge label={p.scope} color={scopeColor(p.scope)} />
                </div>
                <p className="text-xs text-[#636e7b] mb-2">{p.description}</p>
                <pre className="text-[10px] font-mono text-[#4a5568] bg-[#0d1117] border border-[#2d3748] rounded-lg p-2.5 max-h-20 overflow-auto leading-relaxed">{p.yamlSpec}</pre>
              </div>
              <div className="flex gap-1 shrink-0 ml-4">
                <button
                  onClick={() => setEditing(p)}
                  className="text-xs px-2 py-1 text-[#8b949e] hover:text-white hover:bg-[#2d3748] rounded transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => deletePolicy(p.id)}
                  className="text-xs px-2 py-1 text-red-400/60 hover:text-red-400 hover:bg-red-600/10 rounded transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {policies.length === 0 && (
            <div className="px-5 py-8 text-center text-[#4a5568] text-sm">No policies defined</div>
          )}
        </div>
      </SectionCard>

      {editing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-[#13161b] border border-[#2d3748] rounded-2xl w-[560px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#2d3748] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{editing.name ? 'Edit Policy' : 'New Policy'}</h3>
              <button onClick={() => setEditing(null)} className="text-[#636e7b] hover:text-white text-lg">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#8b949e] mb-1">Name</label>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8b949e] mb-1">Scope</label>
                  <select
                    value={editing.scope}
                    onChange={(e) => setEditing({ ...editing, scope: e.target.value as PolicyTemplate['scope'] })}
                    className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="user">User</option>
                    <option value="namespace">Namespace</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8b949e] mb-1">Description</label>
                <input
                  type="text"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8b949e] mb-1">Policy YAML</label>
                <textarea
                  value={editing.yamlSpec}
                  onChange={(e) => setEditing({ ...editing, yamlSpec: e.target.value })}
                  rows={8}
                  className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition font-mono leading-relaxed resize-y"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#2d3748] flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-[#8b949e] border border-[#2d3748] rounded-lg hover:text-white transition">Cancel</button>
              <button
                onClick={() => savePolicy(editing)}
                disabled={!editing.name}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition font-medium"
              >
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Catalog Management
// ---------------------------------------------------------------------------
function CatalogTab({ catalog, onRefresh }: { catalog: CatalogEntry[]; onRefresh: () => void }) {
  const [filter, setFilter] = useState<'all' | 'agent' | 'skill' | 'plugin'>('all');
  const visible = catalog.filter((e) => filter === 'all' || e.category === filter);

  const toggleEnabled = async (entry: CatalogEntry) => {
    await fetch('/api/admin/catalog', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, enabled: !entry.enabled }),
    });
    onRefresh();
  };

  return (
    <SectionCard
      title="Agent, Skill & Plugin Catalog"
      subtitle="Control which items are available to users when deploying"
      action={
        <div className="flex gap-1">
          {(['all', 'agent', 'skill', 'plugin'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition capitalize ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-[#2d3748] text-[#8b949e] hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f + 's'}
            </button>
          ))}
        </div>
      }
    >
      <div className="divide-y divide-[#2d3748]">
        {visible.map((entry) => (
          <div key={entry.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.015] transition">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-xl">{entry.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{entry.name}</p>
                  <Badge label={entry.category} color={entry.category === 'agent' ? 'blue' : entry.category === 'skill' ? 'purple' : 'amber'} />
                </div>
                <p className="text-xs text-[#636e7b] truncate">{entry.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {entry.image && (
                <span className="text-[10px] font-mono text-[#4a5568]">{entry.image}</span>
              )}
              <button
                onClick={() => toggleEnabled(entry)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  entry.enabled ? 'bg-blue-600' : 'bg-[#2d3748]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition ${
                    entry.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="px-5 py-8 text-center text-[#4a5568] text-sm">No catalog entries</div>
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tab: SCM Configuration
// ---------------------------------------------------------------------------
function SCMTab({ scm, onRefresh }: { scm: SCMConfig; onRefresh: () => void }) {
  const [cfg, setCfg] = useState(scm);
  const [saving, setSaving] = useState(false);

  useEffect(() => setCfg(scm), [scm]);

  const save = async () => {
    setSaving(true);
    await fetch('/api/admin/scm', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    setSaving(false);
    onRefresh();
  };

  return (
    <SectionCard title="Source Control Integration" subtitle="Configure GitHub or GitLab for agent workspace repos">
      <div className="px-5 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-1">Provider</label>
            <select
              value={cfg.provider}
              onChange={(e) => setCfg({ ...cfg, provider: e.target.value as 'github' | 'gitlab' })}
              className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
            >
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-1">Organization / Group</label>
            <input
              type="text"
              value={cfg.orgOrGroup}
              onChange={(e) => setCfg({ ...cfg, orgOrGroup: e.target.value })}
              placeholder="my-org"
              className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1">Base URL</label>
          <input
            type="text"
            value={cfg.baseURL}
            onChange={(e) => setCfg({ ...cfg, baseURL: e.target.value })}
            placeholder="https://github.com"
            className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1">
            Allowed Repos <span className="text-[#4a5568] font-normal">(glob patterns, comma-separated)</span>
          </label>
          <input
            type="text"
            value={cfg.allowedRepos}
            onChange={(e) => setCfg({ ...cfg, allowedRepos: e.target.value })}
            placeholder="org/*, org/specific-repo"
            className="w-full bg-[#0d1117] border border-[#2d3748] focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono transition"
          />
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${cfg.tokenSet ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-xs text-[#636e7b]">{cfg.tokenSet ? 'API token configured' : 'No API token set — deploys with repo access will fail'}</span>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition font-medium"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main AdminPanel
// ---------------------------------------------------------------------------
export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [policies, setPolicies] = useState<PolicyTemplate[]>([]);
  const [scm, setSCM] = useState<SCMConfig>({ provider: 'github', orgOrGroup: '', baseURL: 'https://github.com', tokenSet: false, allowedRepos: '' });
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [uRes, pRes, sRes, cRes] = await Promise.all([
        fetch('/api/admin/users').then((r) => r.json()),
        fetch('/api/admin/policies').then((r) => r.json()),
        fetch('/api/admin/scm').then((r) => r.json()),
        fetch('/api/admin/catalog').then((r) => r.json()),
      ]);
      setUsers(uRes.users ?? []);
      setPolicies(pRes.policies ?? []);
      setSCM(sRes);
      setCatalog(cRes.catalog ?? []);
    } catch {
      // ignore on dev when backend is not running
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'users', label: 'Users & Access', icon: '👥' },
    { id: 'policies', label: 'Policies', icon: '🛡️' },
    { id: 'catalog', label: 'Catalog', icon: '📦' },
    { id: 'scm', label: 'Git / SCM', icon: '🔗' },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[#161b22] border border-[#2d3748] rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-[#8b949e] hover:text-white hover:bg-white/5'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'users' && <UsersTab users={users} policies={policies} catalog={catalog} onRefresh={fetchAll} />}
      {tab === 'policies' && <PoliciesTab policies={policies} onRefresh={fetchAll} />}
      {tab === 'catalog' && <CatalogTab catalog={catalog} onRefresh={fetchAll} />}
      {tab === 'scm' && <SCMTab scm={scm} onRefresh={fetchAll} />}
    </div>
  );
}
