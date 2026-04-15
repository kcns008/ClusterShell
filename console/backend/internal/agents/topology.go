package agents

import (
	"context"
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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

// System namespaces to exclude from topology view
var systemNamespaces = map[string]bool{
	"kube-system":                true,
	"kube-public":                true,
	"kube-node-lease":            true,
	"cattle-system":              true,
	"cattle-fleet-system":        true,
	"cattle-monitoring-system":   true,
	"cattle-impersonation-system": true,
	"cattle-resources-system":    true,
	"cert-manager":               true,
	"ingress-nginx":              true,
	"velero":                     true,
	"clustershell-console":       true,
	"longhorn-system":            true,
	"tigera-operator":            true,
	"calico-system":              true,
	"calico-apiserver":           true,
	"gatekeeper-system":          true,
	"local-path-storage":         true,
	" metallb-system":            true,
}

func isSystemNamespace(name string) bool {
	if systemNamespaces[name] {
		return true
	}
	// Also skip any namespace starting with cattle- or kube-
	if strings.HasPrefix(name, "cattle-") || strings.HasPrefix(name, "kube-") {
		return true
	}
	return false
}

func GetTopology(ctx context.Context) (*Topology, error) {
	clientset, err := getClient()
	if err != nil {
		return nil, err
	}

	topology := &Topology{}

	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}

	for _, ns := range namespaces.Items {
		// Skip system namespaces
		if isSystemNamespace(ns.Name) {
			continue
		}

		nsID := fmt.Sprintf("ns-%s", ns.Name)
		topology.Nodes = append(topology.Nodes, TopologyNode{
			ID: nsID, Label: ns.Name, Type: "namespace",
			Status: "running", Namespace: ns.Name,
		})

		pods, _ := clientset.CoreV1().Pods(ns.Name).List(ctx, metav1.ListOptions{})
		for _, pod := range pods.Items {
			podID := fmt.Sprintf("pod-%s-%s", ns.Name, pod.Name)
			topology.Nodes = append(topology.Nodes, TopologyNode{
				ID: podID, Label: pod.Name, Type: "agent",
				Status: string(pod.Status.Phase), Namespace: ns.Name,
			})
			topology.Edges = append(topology.Edges, TopologyEdge{
				ID:     fmt.Sprintf("%s-%s", nsID, podID),
				Source: nsID, Target: podID, Type: "contains",
			})
		}

		services, _ := clientset.CoreV1().Services(ns.Name).List(ctx, metav1.ListOptions{})
		for _, svc := range services.Items {
			// Skip kubernetes headless/default services
			if svc.Name == "kubernetes" {
				continue
			}
			svcID := fmt.Sprintf("svc-%s-%s", ns.Name, svc.Name)
			topology.Nodes = append(topology.Nodes, TopologyNode{
				ID: svcID, Label: svc.Name, Type: "service",
				Status: "running", Namespace: ns.Name,
			})
			for k, v := range svc.Spec.Selector {
				for _, pod := range pods.Items {
					if pod.Labels[k] == v {
						podID := fmt.Sprintf("pod-%s-%s", ns.Name, pod.Name)
						topology.Edges = append(topology.Edges, TopologyEdge{
							ID:     fmt.Sprintf("%s-%s", svcID, podID),
							Source: podID, Target: svcID, Type: "exposes",
						})
					}
				}
			}
		}

		ingresses, _ := clientset.NetworkingV1().Ingresses(ns.Name).List(ctx, metav1.ListOptions{})
		for _, ing := range ingresses.Items {
			ingID := fmt.Sprintf("ing-%s-%s", ns.Name, ing.Name)
			topology.Nodes = append(topology.Nodes, TopologyNode{
				ID: ingID, Label: ing.Name, Type: "ingress",
				Status: "running", Namespace: ns.Name,
			})
			for _, rule := range ing.Spec.Rules {
				if rule.HTTP == nil {
					continue
				}
				for _, path := range rule.HTTP.Paths {
					svcName := path.Backend.Service.Name
					svcID := fmt.Sprintf("svc-%s-%s", ns.Name, svcName)
					topology.Edges = append(topology.Edges, TopologyEdge{
						ID:     fmt.Sprintf("%s-%s", ingID, svcID),
						Source: ingID, Target: svcID, Type: "routes-to",
					})
				}
			}
		}

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
