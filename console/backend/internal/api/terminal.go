package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"

	"github.com/kcns008/clustershell/console/backend/internal/k8sproxy"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// TerminalHandler proxies WebSocket connections to Kubernetes pod exec API.
// Pattern based on OpenShift Console's terminal implementation:
// 1. Browser connects via WebSocket to /terminal/exec?namespace=xxx&pod=xxx
// 2. Backend upgrades connection and creates a remotecommand.Executor
// 3. stdin/stdout/stderr are bridged between WebSocket and the executor
// 4. Resize events are forwarded to the remote terminal
type TerminalHandler struct{}

func NewTerminalHandler() *TerminalHandler {
	return &TerminalHandler{}
}

func (h *TerminalHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	namespace := r.URL.Query().Get("namespace")
	podName := r.URL.Query().Get("pod")
	container := r.URL.Query().Get("container")

	if namespace == "" || podName == "" {
		http.Error(w, "namespace and pod required", http.StatusBadRequest)
		return
	}

	// Upgrade to WebSocket
	wsConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer wsConn.Close()

	// Load kubeconfig
	kubeconfig := clientcmd.NewDefaultClientConfigLoadingRules().GetDefaultFilename()
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		h.sendError(wsConn, "Failed to load kubeconfig: "+err.Error())
		return
	}

	// Create executor stream
	stream := k8sproxy.NewWebSocketStream(wsConn)

	// Build and execute remote command
	executor, err := k8sproxy.NewExecutor(config, namespace, podName, container)
	if err != nil {
		h.sendError(wsConn, "Failed to create executor: "+err.Error())
		return
	}

	// Handle resize events in a goroutine
	go h.handleResize(wsConn, executor)

	// Execute the remote shell command
	err = executor.Execute(r.Context(), stream)
	if err != nil {
		log.Printf("Exec error for %s/%s: %v", namespace, podName, err)
	}
}

func (h *TerminalHandler) handleResize(wsConn *websocket.Conn, executor *k8sproxy.Executor) {
	for {
		_, message, err := wsConn.ReadMessage()
		if err != nil {
			return
		}

		var msg struct {
			Type string `json:"type"`
			Cols uint16 `json:"cols"`
			Rows uint16 `json:"rows"`
		}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		if msg.Type == "resize" {
			executor.Resize(msg.Cols, msg.Rows)
		}
	}
}

func (h *TerminalHandler) sendError(wsConn *websocket.Conn, msg string) {
	data, _ := json.Marshal(map[string]string{"type": "error", "data": msg})
	wsConn.WriteMessage(websocket.TextMessage, data)
}

// Ensure remotecommand.Stream is available
var _ remotecommand.Stream = nil
