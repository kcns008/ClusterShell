package api

import (
	"encoding/json"
	"net/http"

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
		Template  string `json:"template"`
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Deploy based on template
	if err := agents.DeployFromTemplate(r.Context(), req.Template, req.Name, req.Namespace); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "deployed", "name": req.Name})
}
