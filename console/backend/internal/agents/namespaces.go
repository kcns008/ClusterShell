package agents

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NamespaceInfo represents a K8s namespace
type NamespaceInfo struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

// ListNamespaces returns all namespaces
func ListNamespaces(ctx context.Context) ([]NamespaceInfo, error) {
	clientset, err := getClient()
	if err != nil {
		return nil, err
	}

	nsList, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}

	var result []NamespaceInfo
	for _, ns := range nsList.Items {
		result = append(result, NamespaceInfo{
			Name:   ns.Name,
			Status: string(ns.Status.Phase),
		})
	}
	return result, nil
}
