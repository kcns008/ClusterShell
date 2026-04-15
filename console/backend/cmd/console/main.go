package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/kcns008/clustershell/console/backend/internal/api"
)

//go:embed static
var staticFiles embed.FS

func main() {
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/agents", api.ListAgents)
	mux.HandleFunc("/api/topology", api.GetTopology)
	mux.HandleFunc("/api/namespaces", api.ListNamespaces)
	mux.HandleFunc("/api/deploy", api.DeployAgent)
	mux.HandleFunc("/terminal/exec", api.ExecTerminal)

	// Admin API routes
	mux.HandleFunc("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			api.GetAdminUsers(w, r)
		case http.MethodPost, http.MethodPut:
			api.UpsertAdminUser(w, r)
		case http.MethodDelete:
			api.DeleteAdminUser(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/admin/policies", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			api.GetPolicies(w, r)
		case http.MethodPost, http.MethodPut:
			api.UpsertPolicy(w, r)
		case http.MethodDelete:
			api.DeletePolicy(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/admin/scm", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			api.GetSCMConfig(w, r)
		case http.MethodPost, http.MethodPut:
			api.SetSCMConfig(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/admin/catalog", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			api.GetCatalog(w, r)
		case http.MethodPost, http.MethodPut:
			api.UpsertCatalogEntry(w, r)
		case http.MethodDelete:
			api.DeleteCatalogEntry(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Serve frontend static files
	var fileServer http.Handler
	if distDir := os.Getenv("FRONTEND_DIST"); distDir != "" {
		// Docker: serve from mounted directory
		fileServer = http.FileServer(http.Dir(distDir))
	} else {
		// Binary: serve from embedded files
		sub, err := fs.Sub(staticFiles, "static")
		if err != nil {
			log.Fatal(err)
		}
		fileServer = http.FileServer(http.FS(sub))
	}
	mux.Handle("/", fileServer)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("ClusterShell Console starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
