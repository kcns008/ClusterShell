package k8sproxy

import (
	"encoding/json"
	"io"
	"sync"

	"github.com/gorilla/websocket"
)

// Stream bridges WebSocket messages to io.Reader/io.Writer for k8s exec.
// OpenShift Console uses the same pattern: WebSocket ↔ SPDY/chunked transfer.
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

	// Read stdin from WebSocket and write to pipe
	go s.readStdin()

	return s
}

func (s *Stream) Stdin() io.Reader  { return s.stdinR }
func (s *Stream) Stdout() io.Writer { return &wsWriter{s} }
func (s *Stream) Stderr() io.Writer { return &wsWriter{s} }

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

func (s *Stream) writeStdout(data []byte) {
	s.stdoutMu.Lock()
	defer s.stdoutMu.Unlock()

	msg, _ := json.Marshal(map[string]string{
		"type": "stdout",
		"data": string(data),
	})
	s.wsConn.WriteMessage(websocket.TextMessage, msg)
}

type wsWriter struct {
	stream *Stream
}

func (w *wsWriter) Write(p []byte) (n int, err error) {
	w.stream.writeStdout(p)
	return len(p), nil
}
