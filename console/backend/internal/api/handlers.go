package api

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/kcns008/clustershell/console/backend/internal/agents"
)

// ListAgents returns all agent pods across namespaces
func ListAgents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	pods, err := agents.ListAgentPods(r.Context())
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"agents": []interface{}{}, "error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"agents": pods})
}

// GetTopology returns the network topology graph
func GetTopology(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	topology, err := agents.GetTopology(r.Context())
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"nodes": []interface{}{}, "edges": []interface{}{}, "error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(topology)
}

// ListNamespaces returns all namespaces
func ListNamespaces(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	ns, err := agents.ListNamespaces(r.Context())
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"namespaces": []interface{}{}, "error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"namespaces": ns})
}

// DeployAgent handles agent deployment requests
func DeployAgent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Template  string   `json:"template"`
		Name      string   `json:"name"`
		Namespace string   `json:"namespace"`
		GitRepo   string   `json:"gitRepo"`
		Skills    []string `json:"skills"`
		Plugins   []string `json:"plugins"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := agents.DeployFromTemplate(r.Context(), req.Template, req.Name, req.Namespace); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "deployed", "name": req.Name})
}

// DeployHelmChart handles full cluster deployment via Helm chart
func DeployHelmChart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Chart     string `json:"chart"`
		Release   string `json:"release"`
		Namespace string `json:"namespace"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if req.Release == "" || req.Namespace == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "release and namespace are required"})
		return
	}

	if err := agents.DeployHelmChart(r.Context(), req.Chart, req.Release, req.Namespace); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "deployed", "release": req.Release, "namespace": req.Namespace})
}

// ---------------------------------------------------------------------------
// Admin API — in-memory store (backed by clustershell-server in production)
// ---------------------------------------------------------------------------

type adminUser struct {
	ID        string   `json:"id"`
	Email     string   `json:"email"`
	Role      string   `json:"role"` // admin | developer | viewer
	Namespace string   `json:"namespace"`
	Policies  []string `json:"policies"`
	Skills    []string `json:"skills"`
	Agents    []string `json:"agents"`
}

type policyTemplate struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Scope       string `json:"scope"` // sandbox | user | namespace
	YAMLSpec    string `json:"yamlSpec"`
}

type scmConfig struct {
	Provider     string `json:"provider"` // github | gitlab
	OrgOrGroup   string `json:"orgOrGroup"`
	BaseURL      string `json:"baseURL"`
	TokenSet     bool   `json:"tokenSet"`
	AllowedRepos string `json:"allowedRepos"` // comma-separated glob patterns
}

type catalogEntry struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Icon        string   `json:"icon"`
	Image       string   `json:"image"`
	Category    string   `json:"category"` // agent | skill | plugin
	Tags        []string `json:"tags"`
	Enabled     bool     `json:"enabled"`
	Repo        string   `json:"repo"`
	Source      string   `json:"source,omitempty"`      // base | community
	LaunchHint  string   `json:"launchHint,omitempty"`  // CLI hint for community agents
	ProviderEnv string   `json:"providerEnv,omitempty"` // environment variable for the provider key
}

var adminStore = struct {
	mu       sync.RWMutex
	users    []adminUser
	policies []policyTemplate
	scm      scmConfig
	catalog  []catalogEntry
}{
	users: []adminUser{
		{ID: "u1", Email: "admin@example.com", Role: "admin", Namespace: "*", Policies: []string{"p1"}, Skills: []string{"*"}, Agents: []string{"*"}},
		{ID: "u2", Email: "dev@example.com", Role: "developer", Namespace: "default", Policies: []string{"p2"}, Skills: []string{"autonomous-experiment"}, Agents: []string{"opencode", "aider"}},
		{ID: "u3", Email: "viewer@example.com", Role: "viewer", Namespace: "default", Policies: []string{}, Skills: []string{}, Agents: []string{}},
	},
	policies: []policyTemplate{
		{
			ID: "p1", Name: "Unrestricted", Description: "Full access — for admin use only", Scope: "sandbox",
			YAMLSpec: "network_policies:\n  - host: \"*\"\n    action: allow\nprocess:\n  drop_privileges: false\n",
		},
		{
			ID: "p2", Name: "Developer Standard", Description: "Internet access with audit logging", Scope: "sandbox",
			YAMLSpec: "network_policies:\n  - host: \"github.com\"\n    action: allow\n  - host: \"api.openai.com\"\n    action: allow\nprocess:\n  drop_privileges: true\n",
		},
		{
			ID: "p3", Name: "Air-Gapped", Description: "No external network access — local models only", Scope: "sandbox",
			YAMLSpec: "network_policies: []\nprocess:\n  drop_privileges: true\n",
		},
	},
	scm: scmConfig{Provider: "github", OrgOrGroup: "", BaseURL: "https://github.com", TokenSet: false},
	catalog: []catalogEntry{
		{ID: "claude-code", Name: "Claude Code", Description: "Anthropic agentic coding tool — edit files, run commands", Icon: "🧠", Image: "node:22-alpine", Category: "agent", Tags: []string{"coding", "anthropic"}, Enabled: true, Repo: "claude-code", Source: "base", ProviderEnv: "ANTHROPIC_API_KEY"},
		{ID: "opencode", Name: "OpenCode", Description: "Terminal AI coding agent with multi-provider support", Icon: "⚡", Image: "alpine:3.21", Category: "agent", Tags: []string{"coding", "terminal"}, Enabled: true, Repo: "opencode", Source: "base", ProviderEnv: "OPENAI_API_KEY or OPENROUTER_API_KEY"},
		{ID: "codex", Name: "Codex", Description: "OpenAI coding agent — autonomous code generation and editing", Icon: "🔮", Image: "node:22-alpine", Category: "agent", Tags: []string{"coding", "openai"}, Enabled: true, Repo: "codex", Source: "base", ProviderEnv: "OPENAI_API_KEY"},
		{ID: "copilot", Name: "GitHub Copilot CLI", Description: "AI-powered CLI with code suggestions and git assistance", Icon: "🐙", Image: "alpine:3.21", Category: "agent", Tags: []string{"coding", "github"}, Enabled: true, Repo: "github-copilot", Source: "base", ProviderEnv: "GITHUB_TOKEN or COPILOT_GITHUB_TOKEN"},
		{ID: "openclaw", Name: "OpenClaw", Description: "Community agent — launch with openshell sandbox create --from openclaw", Icon: "🦀", Image: "alpine:3.21", Category: "agent", Tags: []string{"community", "sandbox"}, Enabled: true, Repo: "openclaw", Source: "community", LaunchHint: "openshell sandbox create --from openclaw"},
		{ID: "ollama", Name: "Ollama", Description: "Community agent — run local LLMs with Ollama", Icon: "🦙", Image: "alpine:3.21", Category: "agent", Tags: []string{"community", "local-inference"}, Enabled: true, Repo: "ollama", Source: "community", LaunchHint: "openshell sandbox create --from ollama"},
		{ID: "autonomous-experiment", Name: "Autonomous Experiment", Description: "Run timed autonomous research loops", Icon: "🔬", Image: "", Category: "skill", Tags: []string{"research", "experiment"}, Enabled: true, Repo: ".agents/skills/autonomous-experiment"},
		{ID: "build-from-issue", Name: "Build From Issue", Description: "Implement GitHub issues autonomously", Icon: "🔧", Image: "", Category: "skill", Tags: []string{"github", "automation"}, Enabled: true, Repo: ".agents/skills/build-from-issue"},
		{ID: "experiment-tracking", Name: "Experiment Tracking", Description: "Track and compare experiment results", Icon: "📊", Image: "", Category: "skill", Tags: []string{"research", "analytics"}, Enabled: true, Repo: ".agents/skills/experiment-tracking"},
	},
}

// GetAdminUsers returns the user list
func GetAdminUsers(w http.ResponseWriter, r *http.Request) {
	adminStore.mu.RLock()
	defer adminStore.mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"users": adminStore.users})
}

// UpsertAdminUser creates or updates a user
func UpsertAdminUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var u adminUser
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	adminStore.mu.Lock()
	defer adminStore.mu.Unlock()
	for i, existing := range adminStore.users {
		if existing.ID == u.ID {
			adminStore.users[i] = u
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(u)
			return
		}
	}
	adminStore.users = append(adminStore.users, u)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(u)
}

// DeleteAdminUser removes a user by ID
func DeleteAdminUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.URL.Query().Get("id")
	adminStore.mu.Lock()
	defer adminStore.mu.Unlock()
	for i, u := range adminStore.users {
		if u.ID == id {
			adminStore.users = append(adminStore.users[:i], adminStore.users[i+1:]...)
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}
	http.Error(w, "not found", http.StatusNotFound)
}

// GetPolicies returns all policy templates
func GetPolicies(w http.ResponseWriter, r *http.Request) {
	adminStore.mu.RLock()
	defer adminStore.mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"policies": adminStore.policies})
}

// UpsertPolicy creates or updates a policy template
func UpsertPolicy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var p policyTemplate
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	adminStore.mu.Lock()
	defer adminStore.mu.Unlock()
	for i, existing := range adminStore.policies {
		if existing.ID == p.ID {
			adminStore.policies[i] = p
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(p)
			return
		}
	}
	adminStore.policies = append(adminStore.policies, p)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

// DeletePolicy removes a policy by ID
func DeletePolicy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.URL.Query().Get("id")
	adminStore.mu.Lock()
	defer adminStore.mu.Unlock()
	for i, p := range adminStore.policies {
		if p.ID == id {
			adminStore.policies = append(adminStore.policies[:i], adminStore.policies[i+1:]...)
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}
	http.Error(w, "not found", http.StatusNotFound)
}

// GetSCMConfig returns the SCM configuration
func GetSCMConfig(w http.ResponseWriter, r *http.Request) {
	adminStore.mu.RLock()
	defer adminStore.mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(adminStore.scm)
}

// SetSCMConfig updates the SCM configuration
func SetSCMConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var cfg scmConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	adminStore.mu.Lock()
	// Never store the token in plain-text in a real deployment; this is a placeholder.
	adminStore.scm = cfg
	adminStore.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(adminStore.scm)
}

// GetCatalog returns the agent/skill/plugin catalog
func GetCatalog(w http.ResponseWriter, r *http.Request) {
	adminStore.mu.RLock()
	defer adminStore.mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"catalog": adminStore.catalog})
}

// UpsertCatalogEntry creates or updates a catalog entry
func UpsertCatalogEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var entry catalogEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	adminStore.mu.Lock()
	defer adminStore.mu.Unlock()
	for i, existing := range adminStore.catalog {
		if existing.ID == entry.ID {
			adminStore.catalog[i] = entry
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(entry)
			return
		}
	}
	adminStore.catalog = append(adminStore.catalog, entry)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(entry)
}

// DeleteCatalogEntry removes a catalog entry by ID
func DeleteCatalogEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.URL.Query().Get("id")
	adminStore.mu.Lock()
	defer adminStore.mu.Unlock()
	for i, e := range adminStore.catalog {
		if e.ID == id {
			adminStore.catalog = append(adminStore.catalog[:i], adminStore.catalog[i+1:]...)
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}
	http.Error(w, "not found", http.StatusNotFound)
}

