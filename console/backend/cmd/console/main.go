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
