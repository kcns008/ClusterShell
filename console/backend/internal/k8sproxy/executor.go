package k8sproxy

import (
	"context"
	"fmt"
	"net/url"

	"k8s.io/client-go/tools/remotecommand"
)

// Executor handles remote command execution into pods
type Executor struct {
	config    *RestConfigHelper
	namespace string
	podName   string
	container string
	agentCmd  string // optional: agent startup command (e.g. "opencode", "claude")
}

func NewExecutor(namespace, podName, container, agentCmd string) (*Executor, error) {
	return &Executor{
		config:    NewRestConfigHelper(),
		namespace: namespace,
		podName:   podName,
		container: container,
		agentCmd:  agentCmd,
	}, nil
}

// ExecStream creates an exec session and streams to the provided Stream
func (e *Executor) ExecStream(ctx context.Context, stream *Stream) error {
	config, err := e.config.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to get rest config: %w", err)
	}

	execURL := e.buildExecURL(config.Host)

	executor, err := remotecommand.NewSPDYExecutor(config, "POST", execURL)
	if err != nil {
		return fmt.Errorf("failed to create SPDY executor: %w", err)
	}

	return executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:  stream,
		Stdout: stream,
		Stderr: stream,
		Tty:    true,
	})
}

func (e *Executor) buildExecURL(host string) *url.URL {
	// host from rest.Config is already a full URL like "https://10.128.0.1:443"
	base, err := url.Parse(host)
	if err != nil {
		base = &url.URL{Scheme: "https", Host: host}
	}
	u := &url.URL{
		Scheme: base.Scheme,
		Host:   base.Host,
		Path:   fmt.Sprintf("/api/v1/namespaces/%s/pods/%s/exec", e.namespace, e.podName),
	}
	q := u.Query()
	q.Set("stdin", "true")
	q.Set("stdout", "true")
	q.Set("stderr", "true")
	q.Set("tty", "true")

	// Build the startup command: prefer agent command, fall back to bash/sh.
	// Use q.Add (not q.Set) so multiple "command" params are preserved.
	shellCmd := "if command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi"
	if e.agentCmd != "" {
		// Launch the agent if available; fall back to bash/sh so the shell always opens.
		shellCmd = "if command -v " + e.agentCmd + " >/dev/null 2>&1; then exec " + e.agentCmd + "; elif command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi"
	}
	q.Add("command", "/bin/sh")
	q.Add("command", "-c")
	q.Add("command", shellCmd)

	if e.container != "" {
		q.Set("container", e.container)
	}
	u.RawQuery = q.Encode()
	return u
}
