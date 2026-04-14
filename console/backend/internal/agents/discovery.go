package agents

import (
	"context"
	"fmt"
	"os"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// AgentPod represents a deployed agent pod
type AgentPod struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Status    string   `json:"status"`
	Image     string   `json:"image"`
	IP        string   `json:"ip"`
	Node      string   `json:"node"`
	Ports     []string `json:"ports"`
	Created   string   `json:"created"`
}

// ListAgentPods discovers all agent pods across namespaces
func ListAgentPods(ctx context.Context) ([]AgentPod, error) {
	clientset, err := getClient()
	if err != nil {
		return nil, err
	}

	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}

	var agents []AgentPod
	for _, ns := range namespaces.Items {
		pods, err := clientset.CoreV1().Pods(ns.Name).List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}

		for _, pod := range pods.Items {
			agent := AgentPod{
				Name:      pod.Name,
				Namespace: pod.Namespace,
				Status:    string(pod.Status.Phase),
				IP:        pod.Status.PodIP,
				Node:      pod.Spec.NodeName,
				Created:   pod.CreationTimestamp.Format("2006-01-02 15:04"),
			}

			for _, c := range pod.Spec.Containers {
				agent.Image = c.Image
				for _, p := range c.Ports {
					agent.Ports = append(agent.Ports, fmt.Sprintf("%d/%s", p.ContainerPort, p.Protocol))
				}
			}

			agents = append(agents, agent)
		}
	}

	return agents, nil
}

func getClient() (*kubernetes.Clientset, error) {
	config, err := getRestConfig()
	if err != nil {
		return nil, err
	}
	return kubernetes.NewForConfig(config)
}

func getRestConfig() (*rest.Config, error) {
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		return rest.InClusterConfig()
	}
	kubeconfig := clientcmd.NewDefaultClientConfigLoadingRules().GetDefaultFilename()
	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}
