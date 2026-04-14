package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/kcns008/clustershell/console/backend/internal/k8sproxy"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ExecTerminal upgrades to WebSocket and proxies to k8s pod exec
func ExecTerminal(w http.ResponseWriter, r *http.Request) {
	namespace := r.URL.Query().Get("namespace")
	podName := r.URL.Query().Get("pod")
	container := r.URL.Query().Get("container")

	if namespace == "" || podName == "" {
		http.Error(w, "namespace and pod required", http.StatusBadRequest)
		return
	}

	wsConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer wsConn.Close()

	stream := k8sproxy.NewWebSocketStream(wsConn)

	executor, err := k8sproxy.NewExecutor(namespace, podName, container)
	if err != nil {
		sendError(wsConn, "Failed to create executor: "+err.Error())
		return
	}

	if err := executor.ExecStream(r.Context(), stream); err != nil {
		log.Printf("Exec error for %s/%s: %v", namespace, podName, err)
	}
}

func sendError(wsConn *websocket.Conn, msg string) {
	data, _ := json.Marshal(map[string]string{"type": "error", "data": msg})
	wsConn.WriteMessage(websocket.TextMessage, data)
}
