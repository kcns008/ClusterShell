package k8sproxy

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
)

// sizeQueue implements remotecommand.TerminalSizeQueue
type sizeQueue struct {
	ch chan remotecommand.TerminalSize
}

func (s *sizeQueue) Next() *remotecommand.TerminalSize {
	size, ok := <-s.ch
	if !ok {
		return nil
	}
	return &size
}

// Executor wraps Kubernetes remote command execution for pod terminal access.
type Executor struct {
	clientset *kubernetes.Clientset
	config    *rest.Config
	namespace string
	podName   string
	container string
	sizeQueue *sizeQueue
}

func NewExecutor(config *rest.Config, namespace, podName, container string) (*Executor, error) {
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %w", err)
	}

	return &Executor{
		clientset: clientset,
		config:    config,
		namespace: namespace,
		podName:   podName,
		container: container,
		sizeQueue: &sizeQueue{ch: make(chan remotecommand.TerminalSize, 1)},
	}, nil
}

func (e *Executor) Execute(ctx context.Context, stream *Stream) error {
	req := e.clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(e.namespace).
		Name(e.podName).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: e.container,
			Command:   []string{"/bin/sh", "-c", "if command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi"},
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(e.config, "POST", req.URL())
	if err != nil {
		return fmt.Errorf("failed to create SPDY executor: %w", err)
	}

	return executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:             stream.Stdin(),
		Stdout:            stream.Stdout(),
		Stderr:            stream.Stderr(),
		Tty:               true,
		TerminalSizeQueue: e.sizeQueue,
	})
}

func (e *Executor) Resize(cols, rows uint16) {
	// Non-blocking send: drop old size if unread
	select {
	case e.sizeQueue.ch <- remotecommand.TerminalSize{Width: cols, Height: rows}:
	default:
	}
}
