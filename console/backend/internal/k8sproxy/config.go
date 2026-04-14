package k8sproxy

import (
	"os"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// RestConfigHelper provides K8s REST config with in-cluster fallback
type RestConfigHelper struct{}

func NewRestConfigHelper() *RestConfigHelper {
	return &RestConfigHelper{}
}

func (h *RestConfigHelper) GetConfig() (*rest.Config, error) {
	// In-cluster (when running as a pod)
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		return rest.InClusterConfig()
	}
	// Local development (kubeconfig)
	kubeconfig := clientcmd.NewDefaultClientConfigLoadingRules().GetDefaultFilename()
	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}
