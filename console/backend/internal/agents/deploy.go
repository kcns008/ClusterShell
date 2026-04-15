package agents

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// DeployFromTemplate creates a new agent pod from a predefined template
func DeployFromTemplate(ctx context.Context, template, name, namespace string) error {
	clientset, err := getClient()
	if err != nil {
		return err
	}

	pod := buildAgentPod(template, name, namespace)
	if pod == nil {
		return fmt.Errorf("unknown template: %s", template)
	}

	_, err = clientset.CoreV1().Pods(namespace).Create(ctx, pod, metav1.CreateOptions{})
	return err
}

func buildAgentPod(template, name, namespace string) *corev1.Pod {
	templates := map[string]struct {
		image   string
		command []string
	}{
		"copilot": {
			image:   "alpine:3.21",
			command: []string{"/bin/sh", "-c", "apk add --no-cache git curl bash nodejs npm ttyd && echo 'GitHub Copilot CLI ready' && exec ttyd -W -p 7681 /bin/bash"},
		},
		"opencode": {
			image:   "alpine:3.21",
			command: []string{"/bin/sh", "-c", "apk add --no-cache git curl bash ttyd ripgrep fzf && curl -fsSL https://github.com/opencode-ai/opencode/releases/download/v0.0.55/opencode-linux-x86_64.tar.gz | tar xz -C /usr/local/bin && echo 'OpenCode v0.0.55 ready' && exec ttyd -W -p 7681 /bin/bash"},
		},
		"claude-code": {
			image:   "node:22-alpine",
			command: []string{"/bin/sh", "-c", "apk add --no-cache git bash ttyd && npm install -g @anthropic-ai/claude-code && echo 'Claude Code ready' && exec ttyd -W -p 7681 /bin/bash"},
		},
		"aider": {
			image:   "python:3.12-alpine",
			command: []string{"/bin/sh", "-c", "apk add --no-cache git bash ttyd && pip install aider-install && echo 'Aider ready' && exec ttyd -W -p 7681 /bin/bash"},
		},
		"cline": {
			image:   "node:22-alpine",
			command: []string{"/bin/sh", "-c", "apk add --no-cache git bash ttyd && echo 'Cline requires VS Code - deploying as terminal workspace' && exec ttyd -W -p 7681 /bin/bash"},
		},
		"devika": {
			image:   "python:3.12-alpine",
			command: []string{"/bin/sh", "-c", "apk add --no-cache git bash ttyd build-base && pip install devika && echo 'Devika ready' && exec ttyd -W -p 7681 /bin/bash"},
		},
	}

	tmpl, ok := templates[template]
	if !ok {
		return nil
	}

	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"app":                          name,
				"app.kubernetes.io/name":       name,
				"app.kubernetes.io/managed-by": "clustershell",
				"clustershell.io/template":     template,
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:    name,
					Image:   tmpl.image,
					Command: tmpl.command,
					Ports: []corev1.ContainerPort{
						{ContainerPort: 7681, Name: "web-terminal"},
					},
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceMemory: resource.MustParse("256Mi"),
							corev1.ResourceCPU:    resource.MustParse("200m"),
						},
						Limits: corev1.ResourceList{
							corev1.ResourceMemory: resource.MustParse("1Gi"),
							corev1.ResourceCPU:    resource.MustParse("1000m"),
						},
					},
				},
			},
		},
	}
}
