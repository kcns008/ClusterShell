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
}

func NewExecutor(namespace, podName, container string) (*Executor, error) {
	return &Executor{
		config:    NewRestConfigHelper(),
		namespace: namespace,
		podName:   podName,
		container: container,
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
	u := &url.URL{
		Scheme: "https",
		Host:   host,
		Path:   fmt.Sprintf("/api/v1/namespaces/%s/pods/%s/exec", e.namespace, e.podName),
	}
	q := u.Query()
	q.Set("stdin", "true")
	q.Set("stdout", "true")
	q.Set("stderr", "true")
	q.Set("tty", "true")
	q.Set("command", "/bin/sh")
	q.Set("command", "-c")
	q.Set("command", "if command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi")
	if e.container != "" {
		q.Set("container", e.container)
	}
	u.RawQuery = q.Encode()
	return u
}
