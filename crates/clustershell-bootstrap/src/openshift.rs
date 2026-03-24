// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! OpenShift cluster deployment and management.
//!
//! This module provides functionality for deploying ClusterShell components
//! into existing OpenShift clusters instead of creating new K3s clusters.

use crate::pki::PkiBundle;
use k8s_openapi::api::core::v1::{ConfigMap, Namespace, Secret, ServiceAccount};
use kube::api::{Api, DeleteParams, ObjectMeta, Patch, PatchParams, PostParams};
use kube::config::KubeConfigOptions;
use kube::Config;
use miette::{IntoDiagnostic, Result};
use serde_json::json;
use std::collections::BTreeMap;

/// OpenShift deployment configuration
#[derive(Debug, Clone)]
pub struct OpenShiftOptions {
    /// Kubernetes API server URL (if None, uses current context from kubeconfig)
    pub server: Option<String>,
    /// Path to kubeconfig file
    pub kubeconfig: Option<String>,
    /// Context to use from kubeconfig
    pub context: Option<String>,
    /// Namespace to deploy into (default: "clustershell")
    pub namespace: String,
    /// Skip TLS verification
    pub insecure_skip_tls_verify: bool,
    /// Disable gateway authentication (mTLS)
    pub disable_gateway_auth: bool,
    /// Disable TLS entirely
    pub disable_tls: bool,
}

impl Default for OpenShiftOptions {
    fn default() -> Self {
        Self {
            server: None,
            kubeconfig: None,
            context: None,
            namespace: "clustershell".to_string(),
            insecure_skip_tls_verify: false,
            disable_gateway_auth: false,
            disable_tls: false,
        }
    }
}

impl OpenShiftOptions {
    /// Create new options with default namespace
    pub fn new() -> Self {
        Self::default()
    }

    /// Set Kubernetes API server URL
    #[must_use]
    pub fn with_server(mut self, server: impl Into<String>) -> Self {
        self.server = Some(server.into());
        self
    }

    /// Set kubeconfig path
    #[must_use]
    pub fn with_kubeconfig(mut self, kubeconfig: impl Into<String>) -> Self {
        self.kubeconfig = Some(kubeconfig.into());
        self
    }

    /// Set context name
    #[must_use]
    pub fn with_context(mut self, context: impl Into<String>) -> Self {
        self.context = Some(context.into());
        self
    }

    /// Set namespace
    #[must_use]
    pub fn with_namespace(mut self, namespace: impl Into<String>) -> Self {
        self.namespace = namespace.into();
        self
    }

    /// Enable insecure TLS
    #[must_use]
    pub fn with_insecure_skip_tls_verify(mut self, skip: bool) -> Self {
        self.insecure_skip_tls_verify = skip;
        self
    }

    /// Disable gateway authentication
    #[must_use]
    pub fn with_disable_gateway_auth(mut self, disable: bool) -> Self {
        self.disable_gateway_auth = disable;
        self
    }

    /// Disable TLS
    #[must_use]
    pub fn with_disable_tls(mut self, disable: bool) -> Self {
        self.disable_tls = disable;
        self
    }
}

/// OpenShift cluster client
#[derive(Debug)]
pub struct OpenShiftClient {
    client: kube::Client,
    namespace: String,
}

impl OpenShiftClient {
    /// Create a new OpenShift client from options
    pub async fn new(options: &OpenShiftOptions) -> Result<Self> {
        let mut config = if let Some(kubeconfig) = &options.kubeconfig {
            Config::from_kubeconfig(&KubeConfigOptions {
                context: options.context.clone(),
                cluster: options.server.clone(),
                user: None,
            })
            .await
            .into_diagnostic()?
        } else {
            Config::from_kubeconfig(&KubeConfigOptions {
                context: options.context.clone(),
                cluster: options.server.clone(),
                user: None,
            })
            .await
            .or_else(|_| Config::incluster())
            .into_diagnostic()?
        };

        // Configure TLS settings
        config.accept_invalid_certs = options.insecure_skip_tls_verify;

        let client = kube::Client::try_from(config).into_diagnostic()?;

        Ok(Self {
            client,
            namespace: options.namespace.clone(),
        })
    }

    /// Get the namespace
    pub fn namespace(&self) -> &str {
        &self.namespace
    }

    /// Ensure namespace exists
    pub async fn ensure_namespace(&self) -> Result<()> {
        let namespaces: Api<Namespace> = Api::all(self.client.clone());

        match namespaces.get(&self.namespace).await {
            Ok(_) => {
                tracing::debug!("Namespace '{}' already exists", self.namespace);
                Ok(())
            }
            Err(kube::Error::Api(resp)) if resp.code == 404 => {
                let ns = Namespace {
                    metadata: ObjectMeta {
                        name: Some(self.namespace.clone()),
                        labels: Some(BTreeMap::from([(
                            "app.kubernetes.io/managed-by".to_string(),
                            "clustershell".to_string(),
                        )])),
                        ..Default::default()
                    },
                    spec: None,
                    status: None,
                };
                namespaces.create(&PostParams::default(), &ns).await.into_diagnostic()?;
                tracing::info!("Created namespace '{}'", self.namespace);
                Ok(())
            }
            Err(e) => Err(miette::miette!("Failed to check/create namespace: {e}")),
        }
    }

    /// Deploy TLS secrets
    pub async fn deploy_tls_secrets(&self, bundle: &PkiBundle) -> Result<()> {
        let secrets: Api<Secret> = Api::namespaced(self.client.clone(), &self.namespace);

        // Server TLS secret (kubernetes.io/tls type)
        let server_secret = Secret {
            metadata: ObjectMeta {
                name: Some("clustershell-server-tls".to_string()),
                namespace: Some(self.namespace.clone()),
                ..Default::default()
            },
            string_data: Some(BTreeMap::from([
                ("tls.crt".to_string(), bundle.server_cert_pem.clone()),
                ("tls.key".to_string(), bundle.server_key_pem.clone()),
            ])),
            ..Default::default()
        };
        secrets
            .create(&PostParams::default(), &server_secret)
            .await
            .into_diagnostic()?;

        // Client CA secret (Opaque type)
        let ca_secret = Secret {
            metadata: ObjectMeta {
                name: Some("clustershell-server-client-ca".to_string()),
                namespace: Some(self.namespace.clone()),
                ..Default::default()
            },
            string_data: Some(BTreeMap::from([("ca.crt".to_string(), bundle.ca_cert_pem.clone())])),
            ..Default::default()
        };
        secrets.create(&PostParams::default(), &ca_secret).await.into_diagnostic()?;

        // Client TLS secret for sandboxes
        let client_secret = Secret {
            metadata: ObjectMeta {
                name: Some("clustershell-client-tls".to_string()),
                namespace: Some(self.namespace.clone()),
                ..Default::default()
            },
            string_data: Some(BTreeMap::from([
                ("tls.crt".to_string(), bundle.client_cert_pem.clone()),
                ("tls.key".to_string(), bundle.client_key_pem.clone()),
                ("ca.crt".to_string(), bundle.ca_cert_pem.clone()),
            ])),
            ..Default::default()
        };
        secrets.create(&PostParams::default(), &client_secret).await.into_diagnostic()?;

        tracing::info!("TLS secrets deployed to OpenShift namespace '{}'", self.namespace);
        Ok(())
    }

    /// Deploy ClusterShell gateway components
    pub async fn deploy_gateway(
        &self,
        image: &str,
        options: &OpenShiftOptions,
    ) -> Result<String> {
        // Create service account
        let service_accounts: Api<ServiceAccount> =
            Api::namespaced(self.client.clone(), &self.namespace);
        let sa = ServiceAccount {
            metadata: ObjectMeta {
                name: Some("clustershell-gateway".to_string()),
                namespace: Some(self.namespace.clone()),
                ..Default::default()
            },
            ..Default::default()
        };
        service_accounts
            .create(&PostParams::default(), &sa)
            .await
            .into_diagnostic()?;

        // Create ConfigMap with gateway configuration
        let configmap = ConfigMap {
            metadata: ObjectMeta {
                name: Some("clustershell-gateway-config".to_string()),
                namespace: Some(self.namespace.clone()),
                ..Default::default()
            },
            data: Some(BTreeMap::from([
                (
                    "grpcEndpoint".to_string(),
                    format!("https://clustershell-gateway.{}.svc.cluster.local:8080", self.namespace),
                ),
                ("sandboxNamespace".to_string(), self.namespace.clone()),
                ("disableTls".to_string(), options.disable_tls.to_string()),
                (
                    "disableGatewayAuth".to_string(),
                    options.disable_gateway_auth.to_string(),
                ),
            ])),
            ..Default::default()
        };
        let configmaps: Api<ConfigMap> = Api::namespaced(self.client.clone(), &self.namespace);
        configmaps
            .create(&PostParams::default(), &configmap)
            .await
            .into_diagnostic()?;

        tracing::info!(
            "ClusterShell gateway deployed to OpenShift namespace '{}'",
            self.namespace
        );
        Ok(format!(
            "https://clustershell-gateway.{}.svc.cluster.local:8080",
            self.namespace
        ))
    }

    /// Delete ClusterShell resources from OpenShift
    pub async fn delete_resources(&self) -> Result<()> {
        let secrets: Api<Secret> = Api::namespaced(self.client.clone(), &self.namespace);
        let _ = secrets
            .delete("clustershell-server-tls", &DeleteParams::default())
            .await;
        let _ = secrets
            .delete("clustershell-server-client-ca", &DeleteParams::default())
            .await;
        let _ = secrets
            .delete("clustershell-client-tls", &DeleteParams::default())
            .await;

        tracing::info!(
            "ClusterShell resources deleted from OpenShift namespace '{}'",
            self.namespace
        );
        Ok(())
    }
}

/// Deploy ClusterShell to an existing OpenShift cluster
pub async fn deploy_to_openshift(
    options: &OpenShiftOptions,
    image: &str,
) -> Result<String> {
    let client = OpenShiftClient::new(options).await?;

    // Ensure namespace exists
    client.ensure_namespace().await?;

    // Generate PKI certificates
    let bundle = crate::pki::generate_pki(&[])?;
    client.deploy_tls_secrets(&bundle).await?;

    // Deploy gateway
    let endpoint = client.deploy_gateway(image, options).await?;

    Ok(endpoint)
}

/// Check if OpenShift mode should be used
///
/// Returns true if OpenShift environment variables are set
pub fn should_use_openshift() -> bool {
    std::env::var("CLUSTERSHELL_OPENSHIFT_NAMESPACE").is_ok()
        || std::env::var("KUBERNETES_SERVICE_HOST").is_ok()
}

/// Get OpenShift options from environment
pub fn openshift_options_from_env() -> OpenShiftOptions {
    let mut options = OpenShiftOptions::new();

    if let Ok(ns) = std::env::var("CLUSTERSHELL_OPENSHIFT_NAMESPACE") {
        options = options.with_namespace(ns);
    }

    if let Ok(kubeconfig) = std::env::var("KUBECONFIG") {
        options = options.with_kubeconfig(kubeconfig);
    }

    if let Ok(context) = std::env::var("CLUSTERSHELL_OPENSHIFT_CONTEXT") {
        options = options.with_context(context);
    }

    options
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openshift_options_builder() {
        let opts = OpenShiftOptions::new()
            .with_namespace("test-ns")
            .with_context("test-ctx")
            .with_kubeconfig("/path/to/config");

        assert_eq!(opts.namespace, "test-ns");
        assert_eq!(opts.context, Some("test-ctx".to_string()));
        assert_eq!(opts.kubeconfig, Some("/path/to/config".to_string()));
    }
}
