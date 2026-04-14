package k8sproxy

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/util/remotecommand"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
)

// Executor wraps Kubernetes remote command execution for pod terminal access.
type Executor struct {
	config     *rest.Config
	namespace  string
	podName    string
	container  string
	sizeQueue  *remotecommand.TerminalSizeQueue
}

func NewExecutor(config *rest.Config, namespace, podName, container string) (*Executor, error) {
	return &Executor{
		config:    config,
		namespace: namespace,
		podName:   podName,
		container: container,
		sizeQueue: remotecommand.NewTerminalSizeQueue(),
	}, nil
}

func (e *Executor) Execute(ctx context.Context, stream Stream) error {
	req := e.restClient().Post().
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
	e.sizeQueue <- remotecommand.TerminalSize{Width: cols, Height: rows}
}

func (e *Executor) restClient() rest.Interface {
	// Use default k8s client
	config, _ := clientcmd.BuildConfigFromFlags("", clientcmd.NewDefaultClientConfigLoadingRules().GetDefaultFilename())
	client, _ := rest.HTTPWrappersForConfig(config, http.DefaultTransport)
	return client
}
