package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/kcns008/clustershell/console/backend/internal/api"
)

//go:embed all:static
var staticFiles embed.FS

func main() {
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/agents", api.ListAgents)
	mux.HandleFunc("/api/topology", api.GetTopology)
	mux.HandleFunc("/terminal/exec", api.ExecTerminal)

	// Serve frontend static files
	// When running from Docker, static/ contains the built frontend.
	// When running locally for dev, use FRONTEND_DIST env var or fall back to ../frontend/dist.
	staticDir := os.Getenv("FRONTEND_DIST")
	if staticDir != "" {
		mux.Handle("/", http.FileServer(http.Dir(staticDir)))
	} else {
		staticFS, err := fs.Sub(staticFiles, "static")
		if err != nil {
			// Fallback to disk
			mux.Handle("/", http.FileServer(http.Dir("../frontend/dist")))
		} else {
			fileServer := http.FileServer(http.FS(staticFS))
			mux.Handle("/", fileServer)
		}
	}

	log.Println("ClusterShell Console starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
