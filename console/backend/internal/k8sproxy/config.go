package k8sproxy

import (
	"os"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// GetRestConfig returns in-cluster config when running inside a pod,
// or falls back to the default kubeconfig on disk.
func GetRestConfig() (*rest.Config, error) {
	// Check for in-cluster service account
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		config, err := rest.InClusterConfig()
		if err == nil {
			return config, nil
		}
	}

	// Fallback to kubeconfig
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	kubeconfig := loadingRules.GetDefaultFilename()
	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}
