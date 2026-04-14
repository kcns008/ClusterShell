package agents

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Topology represents the network graph of agent deployments
type Topology struct {
	Nodes []TopologyNode `json:"nodes"`
	Edges []TopologyEdge `json:"edges"`
}

type TopologyNode struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Type      string `json:"type"`
	Status    string `json:"status"`
	Namespace string `json:"namespace"`
}

type TopologyEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"`
}

// GetTopology builds a network topology graph from K8s resources.
// Discovers: Namespaces → Pods → Services → Ingresses → PVCs
// Maps relationships between them for visualization.
func GetTopology(ctx context.Context) (*Topology, error) {
	clientset, err := getClient()
	if err != nil {
		return nil, err
	}

	topology := &Topology{}

	// Get namespaces with cluster-shell managed resources
	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/managed-by=clustershell",
	})
	if err != nil {
		// Fallback: scan all namespaces
		namespaces, err = clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to list namespaces: %w", err)
		}
	}

	for _, ns := range namespaces.Items {
		nsID := fmt.Sprintf("ns-%s", ns.Name)
		topology.Nodes = append(topology.Nodes, TopologyNode{
			ID: nsID, Label: ns.Name, Type: "namespace",
			Status: "running", Namespace: ns.Name,
		})

		// Pods
		pods, _ := clientset.CoreV1().Pods(ns.Name).List(ctx, metav1.ListOptions{})
		for _, pod := range pods.Items {
			podID := fmt.Sprintf("pod-%s-%s", ns.Name, pod.Name)
			topology.Nodes = append(topology.Nodes, TopologyNode{
				ID: podID, Label: pod.Name, Type: "agent",
				Status: string(pod.Status.Phase), Namespace: ns.Name,
			})
			topology.Edges = append(topology.Edges, TopologyEdge{
				ID: fmt.Sprintf("%s-%s", nsID, podID),
				Source: nsID, Target: podID, Type: "contains",
			})
		}

		// Services
		services, _ := clientset.CoreV1().Services(ns.Name).List(ctx, metav1.ListOptions{})
		for _, svc := range services.Items {
			svcID := fmt.Sprintf("svc-%s-%s", ns.Name, svc.Name)
			topology.Nodes = append(topology.Nodes, TopologyNode{
				ID: svcID, Label: svc.Name, Type: "service",
				Status: "running", Namespace: ns.Name,
			})

			// Service → Pod edges (by selector)
			for k, v := range svc.Spec.Selector {
				for _, pod := range pods.Items {
					if pod.Labels[k] == v {
						podID := fmt.Sprintf("pod-%s-%s", ns.Name, pod.Name)
						topology.Edges = append(topology.Edges, TopologyEdge{
							ID: fmt.Sprintf("%s-%s", svcID, podID),
							Source: podID, Target: svcID, Type: "exposes",
						})
					}
				}
			}
		}

		// Ingresses
		ingresses, _ := clientset.NetworkingV1().Ingresses(ns.Name).List(ctx, metav1.ListOptions{})
		for _, ing := range ingresses.Items {
			ingID := fmt.Sprintf("ing-%s-%s", ns.Name, ing.Name)
			topology.Nodes = append(topology.Nodes, TopologyNode{
				ID: ingID, Label: ing.Name, Type: "ingress",
				Status: "running", Namespace: ns.Name,
			})
			for _, rule := range ing.Spec.Rules {
				for _, path := range rule.HTTP.Paths {
					svcName := path.Backend.Service.Name
					svcID := fmt.Sprintf("svc-%s-%s", ns.Name, svcName)
					topology.Edges = append(topology.Edges, TopologyEdge{
						ID: fmt.Sprintf("%s-%s", ingID, svcID),
						Source: ingID, Target: svcID, Type: "routes-to",
					})
				}
			}
		}

		// PVCs
		pvcs, _ := clientset.CoreV1().PersistentVolumeClaims(ns.Name).List(ctx, metav1.ListOptions{})
		for _, pvc := range pvcs.Items {
			pvcID := fmt.Sprintf("pvc-%s-%s", ns.Name, pvc.Name)
			topology.Nodes = append(topology.Nodes, TopologyNode{
				ID: pvcID, Label: pvc.Name, Type: "pvc",
				Status: string(pvc.Status.Phase), Namespace: ns.Name,
			})
		}
	}

	return topology, nil
}
