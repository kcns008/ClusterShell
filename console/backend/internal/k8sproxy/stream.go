package k8sproxy

import (
	"encoding/json"
	"io"
	"sync"

	"github.com/gorilla/websocket"
)

// Stream bridges WebSocket messages to io.Reader/io.Writer for k8s exec.
type Stream struct {
	wsConn   *websocket.Conn
	stdinR   *io.PipeReader
	stdinW   *io.PipeWriter
	stdoutMu sync.Mutex
}

func NewWebSocketStream(wsConn *websocket.Conn) *Stream {
	r, w := io.Pipe()
	s := &Stream{
		wsConn: wsConn,
		stdinR: r,
		stdinW: w,
	}
	go s.readStdin()
	return s
}

// Read implements io.Reader (for stdin)
func (s *Stream) Read(p []byte) (n int, err error) {
	return s.stdinR.Read(p)
}

// Write implements io.Writer (for stdout/stderr)
func (s *Stream) Write(p []byte) (n int, err error) {
	s.stdoutMu.Lock()
	defer s.stdoutMu.Unlock()
	msg, _ := json.Marshal(map[string]string{
		"type": "stdout",
		"data": string(p),
	})
	s.wsConn.WriteMessage(websocket.TextMessage, msg)
	return len(p), nil
}

func (s *Stream) readStdin() {
	for {
		_, message, err := s.wsConn.ReadMessage()
		if err != nil {
			return
		}
		var msg struct {
			Type string `json:"type"`
			Data string `json:"data"`
		}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}
		if msg.Type == "stdin" {
			s.stdinW.Write([]byte(msg.Data))
		}
	}
}
