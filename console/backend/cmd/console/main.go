package main

import (
	"log"
	"net/http"

	"github.com/kcns008/clustershell/console/backend/internal/api"
)

func main() {
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/agents", api.ListAgents)
	mux.HandleFunc("/api/topology", api.GetTopology)
	mux.HandleFunc("/terminal/exec", api.ExecTerminal)

	// Serve frontend static files
	fs := http.FileServer(http.Dir("../frontend/dist"))
	mux.Handle("/", fs)

	log.Println("ClusterShell Console starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
