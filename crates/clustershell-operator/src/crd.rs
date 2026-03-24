// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! Custom Resource Definitions for ClusterShell Operator
//!
//! These CRDs align with the kubernetes-sigs/agent-sandbox specification
//! for managing isolated, stateful, singleton workloads.

use k8s_openapi::api::core::v1::{PersistentVolumeClaimSpec, PodSpec};
use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// ShutdownPolicy describes the policy for deleting the Sandbox when it expires.
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "PascalCase")]
pub enum ShutdownPolicy {
    /// Delete the Sandbox when expired
    Delete,
    /// Keep the Sandbox when expired (Status will show Expired)
    Retain,
}

impl Default for ShutdownPolicy {
    fn default() -> Self {
        ShutdownPolicy::Retain
    }
}

/// Lifecycle defines the lifecycle management for the Sandbox.
#[derive(Clone, Debug, Default, Deserialize, Serialize, JsonSchema)]
pub struct Lifecycle {
    /// shutdownTime is the absolute time when the sandbox expires.
    /// +kubebuilder:validation:Format="date-time"
    #[serde(rename = "shutdownTime", skip_serializing_if = "Option::is_none")]
    pub shutdown_time: Option<String>,

    /// shutdownPolicy determines if the Sandbox resource itself should be deleted when it expires.
    /// Underlying resources (Pods, Services) are always deleted on expiry.
    /// +kubebuilder:default=Retain
    #[serde(rename = "shutdownPolicy", skip_serializing_if = "Option::is_none")]
    pub shutdown_policy: Option<ShutdownPolicy>,
}

/// SandboxPhase represents the lifecycle phase of a Sandbox.
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum SandboxPhase {
    /// Sandbox is pending creation
    Pending,
    /// Sandbox is being created
    Creating,
    /// Sandbox is running
    Running,
    /// Sandbox is paused/hibernated
    Paused,
    /// Sandbox is being resumed from hibernation
    Resuming,
    /// Sandbox is terminating
    Terminating,
    /// Sandbox has terminated
    Terminated,
    /// Sandbox has expired
    Expired,
    /// Sandbox creation failed
    Failed,
}

/// SandboxCondition represents a condition of a Sandbox.
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
pub struct SandboxCondition {
    /// Type of the condition
    #[serde(rename = "type")]
    pub type_: String,
    /// Status of the condition (True, False, Unknown)
    pub status: String,
    /// Last time the condition transitioned
    #[serde(rename = "lastTransitionTime", skip_serializing_if = "Option::is_none")]
    pub last_transition_time: Option<String>,
    /// Reason for the condition's last transition
    #[serde(rename = "lastTransitionReason", skip_serializing_if = "Option::is_none")]
    pub last_transition_reason: Option<String>,
    /// Human-readable message indicating details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// RuntimeClass specifies the isolation runtime for the Sandbox.
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "PascalCase")]
pub enum RuntimeClass {
    /// Standard container runtime (no extra isolation)
    Standard,
    /// gVisor runtime for enhanced isolation
    GVisor,
    /// Kata Containers runtime for VM-level isolation
    Kata,
}

impl Default for RuntimeClass {
    fn default() -> Self {
        RuntimeClass::Standard
    }
}

/// PodMetadata holds metadata that can be applied to pods.
#[derive(Clone, Debug, Default, Deserialize, Serialize, JsonSchema)]
pub struct PodMetadata {
    /// Labels to apply to the pod
    #[serde(skip_serializing_if = "Option::is_none")]
    pub labels: Option<HashMap<String, String>>,
    /// Annotations to apply to the pod
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotations: Option<HashMap<String, String>>,
}

/// PodTemplate describes the pod that will be created for the Sandbox.
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
pub struct PodTemplate {
    /// Metadata for the pod
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<PodMetadata>,
    /// Pod specification
    pub spec: PodSpec,
}

/// PersistentVolumeClaimTemplate describes a PVC template for the Sandbox.
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
pub struct PersistentVolumeClaimTemplate {
    /// Metadata for the PVC
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<PodMetadata>,
    /// PVC specification
    pub spec: PersistentVolumeClaimSpec,
}

/// SandboxSpec defines the desired state of Sandbox
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
pub struct SandboxSpec {
    /// podTemplate describes the pod spec that will be used to create the sandbox.
    #[serde(rename = "podTemplate")]
    pub pod_template: PodTemplate,

    /// volumeClaimTemplates is a list of claims that the sandbox pod is allowed to reference.
    #[serde(rename = "volumeClaimTemplates", skip_serializing_if = "Option::is_none")]
    pub volume_claim_templates: Option<Vec<PersistentVolumeClaimTemplate>>,

    /// Lifecycle defines when and how the sandbox should be shut down.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lifecycle: Option<Lifecycle>,

    /// replicas is the number of desired replicas.
    /// The only allowed values are 0 and 1.
    /// Defaults to 1.
    /// +kubebuilder:validation:Minimum=0
    /// +kubebuilder:validation:Maximum=1
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replicas: Option<i32>,

    /// runtimeClass specifies the isolation runtime to use for the sandbox.
    /// Supports Standard, GVisor, and Kata for strong isolation of untrusted code.
    /// +kubebuilder:default=Standard
    #[serde(rename = "runtimeClass", skip_serializing_if = "Option::is_none")]
    pub runtime_class: Option<RuntimeClass>,

    /// hibernationEnabled allows the sandbox to be hibernated (scaled to zero) when idle.
    /// The sandbox state is preserved and can be resumed on demand.
    /// +kubebuilder:default=false
    #[serde(rename = "hibernationEnabled", skip_serializing_if = "Option::is_none")]
    pub hibernation_enabled: Option<bool>,

    /// idleTimeoutSeconds is the duration after which an idle sandbox will be hibernated.
    /// Only applicable when hibernationEnabled is true.
    /// +kubebuilder:default=3600
    #[serde(rename = "idleTimeoutSeconds", skip_serializing_if = "Option::is_none")]
    pub idle_timeout_seconds: Option<i32>,
}

/// SandboxStatus defines the observed state of Sandbox
#[derive(Clone, Debug, Default, Deserialize, Serialize, JsonSchema)]
pub struct SandboxStatus {
    /// serviceFQDN that is valid for default cluster settings
    #[serde(rename = "serviceFQDN", skip_serializing_if = "Option::is_none")]
    pub service_fqdn: Option<String>,

    /// service is the name of the service created for this sandbox
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,

    /// phase represents the current lifecycle phase of the sandbox
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase: Option<SandboxPhase>,

    /// conditions defines the status conditions array
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<SandboxCondition>>,

    /// replicas is the number of actual replicas
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replicas: Option<i32>,

    /// selector is the label selector for pods
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selector: Option<String>,

    /// podName is the name of the pod backing this sandbox
    #[serde(rename = "podName", skip_serializing_if = "Option::is_none")]
    pub pod_name: Option<String>,

    /// observedGeneration is the most recent generation observed by the controller
    #[serde(rename = "observedGeneration", skip_serializing_if = "Option::is_none")]
    pub observed_generation: Option<i64>,
}

/// Sandbox is the Schema for the sandboxes API
/// +kubebuilder:object:root=true
/// +kubebuilder:subresource:status
/// +kubebuilder:subresource:scale:specpath=.spec.replicas,statuspath=.status.replicas,selectorpath=.status.selector
/// +kubebuilder:resource:scope=Namespaced,shortName=sandbox
/// +kubebuilder:printcolumn:name="Phase",type="string",JSONPath=".status.phase"
/// +kubebuilder:printcolumn:name="Replicas",type="integer",JSONPath=".status.replicas"
/// +kubebuilder:printcolumn:name="Age",type="date",JSONPath=".metadata.creationTimestamp"
#[derive(Clone, Debug, CustomResource, Deserialize, Serialize, JsonSchema)]
#[kube(
    group = "agents.x-k8s.io",
    version = "v1alpha1",
    kind = "Sandbox",
    namespaced,
    status = "SandboxStatus",
    shortname = "sandbox"
)]
pub struct SandboxSpec {}

// ============================================================================
// SandboxTemplate CRD
// ============================================================================

/// SandboxTemplateSpec defines the desired state of SandboxTemplate
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
pub struct SandboxTemplateSpec {
    /// template is the base pod template for sandboxes created from this template
    pub template: PodTemplate,

    /// volumeClaimTemplates are PVC templates for sandboxes created from this template
    #[serde(rename = "volumeClaimTemplates", skip_serializing_if = "Option::is_none")]
    pub volume_claim_templates: Option<Vec<PersistentVolumeClaimTemplate>>,

    /// defaultLifecycle is the default lifecycle configuration for sandboxes
    #[serde(rename = "defaultLifecycle", skip_serializing_if = "Option::is_none")]
    pub default_lifecycle: Option<Lifecycle>,

    /// defaultRuntimeClass is the default runtime class for sandboxes
    #[serde(rename = "defaultRuntimeClass", skip_serializing_if = "Option::is_none")]
    pub default_runtime_class: Option<RuntimeClass>,

    /// defaultHibernationEnabled is the default hibernation setting
    #[serde(rename = "defaultHibernationEnabled", skip_serializing_if = "Option::is_none")]
    pub default_hibernation_enabled: Option<bool>,

    /// defaultIdleTimeoutSeconds is the default idle timeout
    #[serde(rename = "defaultIdleTimeoutSeconds", skip_serializing_if = "Option::is_none")]
    pub default_idle_timeout_seconds: Option<i32>,
}

/// SandboxTemplateStatus defines the observed state of SandboxTemplate
#[derive(Clone, Debug, Default, Deserialize, Serialize, JsonSchema)]
pub struct SandboxTemplateStatus {
    /// sandboxCount is the number of sandboxes created from this template
    #[serde(rename = "sandboxCount", skip_serializing_if = "Option::is_none")]
    pub sandbox_count: Option<i32>,

    /// conditions defines the status conditions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<SandboxCondition>>,
}

/// SandboxTemplate provides reusable templates for creating Sandboxes
/// +kubebuilder:object:root=true
/// +kubebuilder:subresource:status
/// +kubebuilder:resource:scope=Namespaced,shortName=sbtemplate
#[derive(Clone, Debug, CustomResource, Deserialize, Serialize, JsonSchema)]
#[kube(
    group = "agents.x-k8s.io",
    version = "v1alpha1",
    kind = "SandboxTemplate",
    namespaced,
    status = "SandboxTemplateStatus",
    shortname = "sbtemplate"
)]
pub struct SandboxTemplateSpec {}

// ============================================================================
// SandboxClaim CRD
// ============================================================================

/// SandboxClaimSpec defines the desired state of SandboxClaim
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
pub struct SandboxClaimSpec {
    /// templateRef references a SandboxTemplate to use for creating the sandbox
    #[serde(rename = "templateRef")]
    pub template_ref: String,

    /// sandboxNamePrefix is an optional prefix for the generated sandbox name
    #[serde(rename = "sandboxNamePrefix", skip_serializing_if = "Option::is_none")]
    pub sandbox_name_prefix: Option<String>,

    /// overrides allows overriding template settings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overrides: Option<SandboxSpec>,
}

/// SandboxClaimStatus defines the observed state of SandboxClaim
#[derive(Clone, Debug, Default, Deserialize, Serialize, JsonSchema)]
pub struct SandboxClaimStatus {
    /// phase represents the current phase of the claim
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase: Option<String>,

    /// sandboxRef references the created sandbox
    #[serde(rename = "sandboxRef", skip_serializing_if = "Option::is_none")]
    pub sandbox_ref: Option<String>,

    /// conditions defines the status conditions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<SandboxCondition>>,
}

/// SandboxClaim allows users to create Sandboxes from a template
/// +kubebuilder:object:root=true
/// +kubebuilder:subresource:status
/// +kubebuilder:resource:scope=Namespaced,shortName=sbclaim
#[derive(Clone, Debug, CustomResource, Deserialize, Serialize, JsonSchema)]
#[kube(
    group = "agents.x-k8s.io",
    version = "v1alpha1",
    kind = "SandboxClaim",
    namespaced,
    status = "SandboxClaimStatus",
    shortname = "sbclaim"
)]
pub struct SandboxClaimSpec {}

// ============================================================================
// SandboxWarmPool CRD
// ============================================================================

/// SandboxWarmPoolSpec defines the desired state of SandboxWarmPool
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
pub struct SandboxWarmPoolSpec {
    /// templateRef references a SandboxTemplate for warming pool sandboxes
    #[serde(rename = "templateRef")]
    pub template_ref: String,

    /// minReady is the minimum number of ready sandboxes to maintain
    /// +kubebuilder:default=1
    #[serde(rename = "minReady", skip_serializing_if = "Option::is_none")]
    pub min_ready: Option<i32>,

    /// maxSize is the maximum number of sandboxes in the pool
    /// +kubebuilder:default=5
    #[serde(rename = "maxSize", skip_serializing_if = "Option::is_none")]
    pub max_size: Option<i32>,

    /// scaleDownDelaySeconds is the delay before scaling down excess sandboxes
    /// +kubebuilder:default=300
    #[serde(rename = "scaleDownDelaySeconds", skip_serializing_if = "Option::is_none")]
    pub scale_down_delay_seconds: Option<i32>,
}

/// WarmPoolSandbox represents a sandbox in the warm pool
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
pub struct WarmPoolSandbox {
    /// name is the name of the sandbox
    pub name: String,
    /// state is the current state (Ready, Allocated, Terminating)
    pub state: String,
    /// allocationTime is when the sandbox was allocated (if allocated)
    #[serde(rename = "allocationTime", skip_serializing_if = "Option::is_none")]
    pub allocation_time: Option<String>,
}

/// SandboxWarmPoolStatus defines the observed state of SandboxWarmPool
#[derive(Clone, Debug, Default, Deserialize, Serialize, JsonSchema)]
pub struct SandboxWarmPoolStatus {
    /// readyCount is the number of ready sandboxes
    #[serde(rename = "readyCount", skip_serializing_if = "Option::is_none")]
    pub ready_count: Option<i32>,

    /// totalCount is the total number of sandboxes in the pool
    #[serde(rename = "totalCount", skip_serializing_if = "Option::is_none")]
    pub total_count: Option<i32>,

    /// sandboxes is the list of sandboxes in the pool
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sandboxes: Option<Vec<WarmPoolSandbox>>,

    /// conditions defines the status conditions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<SandboxCondition>>,
}

/// SandboxWarmPool manages a pool of pre-warmed Sandbox pods
/// +kubebuilder:object:root=true
/// +kubebuilder:subresource:status
/// +kubebuilder:resource:scope=Namespaced,shortName=sbwarm
#[derive(Clone, Debug, CustomResource, Deserialize, Serialize, JsonSchema)]
#[kube(
    group = "agents.x-k8s.io",
    version = "v1alpha1",
    kind = "SandboxWarmPool",
    namespaced,
    status = "SandboxWarmPoolStatus",
    shortname = "sbwarm"
)]
pub struct SandboxWarmPoolSpec {}
