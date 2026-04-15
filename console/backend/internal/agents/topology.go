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

	// Only show agent pods — those with app.kubernetes.io/managed-by=clustershell label
	// or in agent-specific namespaces (opencode, clustershell-console, etc.)
	agentLabel := "app.kubernetes.io/managed-by"
	agentValue := "clustershell"

	// Known agent namespaces (always include even if empty)
	agentNamespaces := map[string]bool{
		"opencode":              true,
		"clustershell-console":  true,
	}

	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}

	for _, ns := range namespaces.Items {
		if isSystemNamespace(ns.Name) {
			continue
		}

		// List only agent pods in this namespace
		pods, _ := clientset.CoreV1().Pods(ns.Name).List(ctx, metav1.ListOptions{})

		var agentPods []TopologyNode
		hasAgentPods := false
		for _, pod := range pods.Items {
			isAgent := false
			if pod.Labels[agentLabel] == agentValue {
				isAgent = true
			}
			if pod.Labels["clustershell.io/template"] != "" {
				isAgent = true
			}
			if agentNamespaces[ns.Name] {
				isAgent = true
			}
			if isAgent {
				hasAgentPods = true
				agentPods = append(agentPods, TopologyNode{
					ID: fmt.Sprintf("pod-%s-%s", ns.Name, pod.Name),
					Label: pod.Name, Type: "agent",
					Status: string(pod.Status.Phase), Namespace: ns.Name,
				})
			}
		}

		// Skip namespaces with no agent pods
		if !hasAgentPods {
			continue
		}

		nsID := fmt.Sprintf("ns-%s", ns.Name)
		topology.Nodes = append(topology.Nodes, TopologyNode{
			ID: nsID, Label: ns.Name, Type: "namespace",
			Status: "running", Namespace: ns.Name,
		})

		// Add agent pod nodes and edges
		for _, pod := range agentPods {
			topology.Nodes = append(topology.Nodes, pod)
			topology.Edges = append(topology.Edges, TopologyEdge{
				ID:     fmt.Sprintf("%s-%s", nsID, pod.ID),
				Source: nsID, Target: pod.ID, Type: "contains",
			})
		}

		// Services — only those matching agent pods
		services, _ := clientset.CoreV1().Services(ns.Name).List(ctx, metav1.ListOptions{})
		for _, svc := range services.Items {
			if svc.Name == "kubernetes" {
				continue
			}
			// Check if this service selects any agent pods
			matchAgent := agentNamespaces[ns.Name] // always show services in agent namespaces
			if !matchAgent {
				for k, v := range svc.Spec.Selector {
					for _, pod := range pods.Items {
						if pod.Labels[k] == v && (pod.Labels[agentLabel] == agentValue || pod.Labels["clustershell.io/template"] != "") {
							matchAgent = true
							break
						}
					}
					if matchAgent {
						break
					}
				}
			}
			if !matchAgent {
				continue
			}

			svcID := fmt.Sprintf("svc-%s-%s", ns.Name, svc.Name)
			topology.Nodes = append(topology.Nodes, TopologyNode{
				ID: svcID, Label: svc.Name, Type: "service",
				Status: "running", Namespace: ns.Name,
			})
			for _, pod := range agentPods {
				for k, v := range svc.Spec.Selector {
					for _, p := range pods.Items {
						if p.Labels[k] == v && fmt.Sprintf("pod-%s-%s", ns.Name, p.Name) == pod.ID {
							topology.Edges = append(topology.Edges, TopologyEdge{
								ID:     fmt.Sprintf("%s-%s", svcID, pod.ID),
								Source: pod.ID, Target: svcID, Type: "exposes",
							})
						}
					}
				}
			}
		}

		// Ingresses — only those routing to agent services
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
					svcID := fmt.Sprintf("svc-%s-%s", ns.Name, path.Backend.Service.Name)
					topology.Edges = append(topology.Edges, TopologyEdge{
						ID:     fmt.Sprintf("%s-%s", ingID, svcID),
						Source: ingID, Target: svcID, Type: "routes-to",
					})
				}
			}
		}

		// PVCs — only those in agent namespaces
		if agentNamespaces[ns.Name] {
			pvcs, _ := clientset.CoreV1().PersistentVolumeClaims(ns.Name).List(ctx, metav1.ListOptions{})
			for _, pvc := range pvcs.Items {
				pvcID := fmt.Sprintf("pvc-%s-%s", ns.Name, pvc.Name)
				topology.Nodes = append(topology.Nodes, TopologyNode{
					ID: pvcID, Label: pvc.Name, Type: "pvc",
					Status: string(pvc.Status.Phase), Namespace: ns.Name,
				})
			}
		}
	}

	return topology, nil
}
