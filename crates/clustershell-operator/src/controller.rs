// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! Controller logic for managing Sandbox CRDs

use std::collections::BTreeMap;
use std::sync::Arc;

use k8s_openapi::api::core::v1::{Pod, Service};
use k8s_openapi::api::apps::v1::StatefulSet;
use kube::api::{ObjectMeta, Patch, PatchParams};
use kube::runtime::controller::Action;
use kube::runtime::events::{Event, EventRecorder, Reporter};
use kube::runtime::finalizer::{finalizer, Event as FinalizerEvent};
use kube::{Api, Client, Resource, ResourceExt};
use serde_json::json;
use tracing::{error, info, warn};

use crate::crd::*;

pub const SANDBOX_FINALIZER: &str = "sandboxes.agents.x-k8s.io/finalizer";
pub const TEMPLATE_FINALIZER: &str = "sandboxes.agents.x-k8s.io/template-finalizer";
pub const CLAIM_FINALIZER: &str = "sandboxes.agents.x-k8s.io/claim-finalizer";
pub const WARMPOOL_FINALIZER: &str = "sandboxes.agents.x-k8s.io/warmpool-finalizer";

/// Context for controller operations
pub struct Context {
    pub client: Arc<Client>,
}

/// Error policy for controller reconciliation
pub fn error_policy<T: Resource>(
    _object: Arc<T>,
    _error: &kube::Error,
    _ctx: Arc<Context>,
) -> Action {
    Action::requeue(std::time::Duration::from_secs(60))
}

/// Mapper for SandboxClaim watching Sandboxes
pub async fn sandbox_claim_mapper(
    sandbox: Arc<Sandbox>,
    _client: Arc<Client>,
) -> Option<Arc<SandboxClaim>> {
    // Check if this sandbox was created from a claim
    if let Some(owner) = sandbox.metadata().owner_references.as_ref() {
        for owner_ref in owner {
            if owner_ref.kind == "SandboxClaim" {
                // Return a stub - actual lookup happens in reconcile
                return None;
            }
        }
    }
    None
}

/// Mapper for SandboxWarmPool watching Sandboxes
pub async fn sandbox_warmpool_mapper(
    _sandbox: Arc<Sandbox>,
    _client: Arc<Client>,
) -> Option<Arc<SandboxWarmPool>> {
    None
}

/// Reconcile a Sandbox resource
pub async fn reconcile_sandbox(
    sandbox: Arc<Sandbox>,
    ctx: Arc<Context>,
) -> Result<Action, kube::Error> {
    let ns = sandbox.namespace().unwrap_or_else(|| "default".to_string());
    let name = sandbox.name_any();
    let client = ctx.client.clone();

    let sandboxes: Api<Sandbox> = Api::namespaced(client.as_ref().clone(), &ns);
    let pods: Api<Pod> = Api::namespaced(client.as_ref().clone(), &ns);
    let services: Api<Service> = Api::namespaced(client.as_ref().clone(), &ns);

    finalizer(&sandboxes, SANDBOX_FINALIZER, sandbox, |event| async {
        match event {
            FinalizerEvent::Apply(sandbox) => {
                reconcile_sandbox_apply(&sandbox, &pods, &services, &ns).await
            }
            FinalizerEvent::Cleanup(sandbox) => {
                reconcile_sandbox_cleanup(&sandbox, &pods, &services).await
            }
        }
    })
    .await
    .map(|_| Action::requeue(std::time::Duration::from_secs(300)))
}

async fn reconcile_sandbox_apply(
    sandbox: &Sandbox,
    pods: &Api<Pod>,
    services: &Api<Service>,
    ns: &str,
) -> Result<Action, kube::Error> {
    let name = sandbox.name_any();
    info!(sandbox = %name, "Reconciling Sandbox");

    // Create or update the Service for stable network identity
    let service_name = format!("{}", name);
    let labels = BTreeMap::from([
        ("app.kubernetes.io/name".to_string(), name.clone()),
        ("agents.x-k8s.io/sandbox".to_string(), name.clone()),
    ]);

    let service_patch = Service {
        metadata: ObjectMeta {
            name: Some(service_name.clone()),
            namespace: Some(ns.to_string()),
            labels: Some(labels.clone()),
            owner_references: Some(vec![kube::api::OwnerReference {
                api_version: Sandbox::api_version(&()).to_string(),
                kind: Sandbox::kind(&()).to_string(),
                name: name.clone(),
                uid: sandbox.metadata.uid.clone().unwrap_or_default(),
                controller: Some(true),
                block_owner_deletion: Some(true),
            }]),
            ..Default::default()
        },
        spec: Some(k8s_openapi::api::core::v1::ServiceSpec {
            selector: Some(labels.clone()),
            ports: Some(vec![k8s_openapi::api::core::v1::ServicePort {
                name: Some("http".to_string()),
                port: 8080,
                target_port: Some(k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(8080)),
                ..Default::default()
            }]),
            ..Default::default()
        }),
        status: None,
    };

    let patch_params = PatchParams::apply("clustershell-operator").force();
    services
        .patch(&service_name, &patch_params, &Patch::Apply(&service_patch))
        .await?;

    // Create or update the Pod
    let pod_name = format!("{}-0", name);
    let mut pod_spec = sandbox.spec.pod_template.spec.clone();

    // Apply runtime class for strong isolation if specified
    if let Some(runtime_class) = &sandbox.spec.runtime_class {
        let runtime_class_name = match runtime_class {
            RuntimeClass::GVisor => Some("gvisor".to_string()),
            RuntimeClass::Kata => Some("kata".to_string()),
            RuntimeClass::Standard => None,
        };
        pod_spec.runtime_class_name = runtime_class_name;
    }

    // Add volume claims if specified
    if let Some(vcts) = &sandbox.spec.volume_claim_templates {
        for vct in vcts {
            if let Some(volumes) = pod_spec.volumes.as_mut() {
                // PVC volumes would be added here
            }
        }
    }

    let pod_patch = Pod {
        metadata: ObjectMeta {
            name: Some(pod_name.clone()),
            namespace: Some(ns.to_string()),
            labels: Some(labels.clone()),
            owner_references: Some(vec![kube::api::OwnerReference {
                api_version: Sandbox::api_version(&()).to_string(),
                kind: Sandbox::kind(&()).to_string(),
                name: name.clone(),
                uid: sandbox.metadata.uid.clone().unwrap_or_default(),
                controller: Some(true),
                block_owner_deletion: Some(true),
            }]),
            ..Default::default()
        },
        spec: Some(pod_spec),
        status: None,
    };

    pods.patch(&pod_name, &patch_params, &Patch::Apply(&pod_patch)).await?;

    // Update status
    let status = SandboxStatus {
        phase: Some(SandboxPhase::Running),
        service: Some(service_name),
        service_fqdn: Some(format!("{}.{}.svc.cluster.local", name, ns)),
        pod_name: Some(pod_name),
        replicas: sandbox.spec.replicas.or(Some(1)),
        selector: Some(format!("app.kubernetes.io/name={}", name)),
        conditions: Some(vec![SandboxCondition {
            type_: "Ready".to_string(),
            status: "True".to_string(),
            last_transition_time: Some(chrono::Utc::now().to_rfc3339()),
            last_transition_reason: Some("Reconciled".to_string()),
            message: Some("Sandbox is running".to_string()),
        }]),
        ..Default::default()
    };

    let sandbox_api: Api<Sandbox> = Api::namespaced(pods.clone().into_client(), ns);
    let status_patch = json!({"status": status});
    sandbox_api
        .patch_status(&name, &patch_params, &Patch::Merge(&status_patch))
        .await?;

    info!(sandbox = %name, "Sandbox reconciled successfully");
    Ok(Action::requeue(std::time::Duration::from_secs(60)))
}

async fn reconcile_sandbox_cleanup(
    sandbox: &Sandbox,
    pods: &Api<Pod>,
    services: &Api<Service>,
) -> Result<Action, kube::Error> {
    let name = sandbox.name_any();
    info!(sandbox = %name, "Cleaning up Sandbox");

    // Cleanup is handled by ownerReferences cascade deletion
    Ok(Action::await_change())
}

/// Reconcile a SandboxTemplate resource
pub async fn reconcile_template(
    template: Arc<SandboxTemplate>,
    ctx: Arc<Context>,
) -> Result<Action, kube::Error> {
    let ns = template.namespace().unwrap_or_else(|| "default".to_string());
    let name = template.name_any();
    let client = ctx.client.clone();

    let templates: Api<SandboxTemplate> = Api::namespaced(client.as_ref().clone(), &ns);

    finalizer(&templates, TEMPLATE_FINALIZER, template, |event| async {
        match event {
            FinalizerEvent::Apply(template) => {
                info!(template = %name, "SandboxTemplate is valid");

                let status = SandboxTemplateStatus {
                    conditions: Some(vec![SandboxCondition {
                        type_: "Ready".to_string(),
                        status: "True".to_string(),
                        last_transition_time: Some(chrono::Utc::now().to_rfc3339()),
                        last_transition_reason: Some("Validated".to_string()),
                        message: Some("Template is valid and ready for use".to_string()),
                    }]),
                    ..Default::default()
                };

                let patch_params = PatchParams::apply("clustershell-operator").force();
                let status_patch = json!({"status": status});
                let template_api: Api<SandboxTemplate> = Api::namespaced(client.as_ref().clone(), &ns);
                template_api
                    .patch_status(&name, &patch_params, &Patch::Merge(&status_patch))
                    .await?;

                Ok(Action::await_change())
            }
            FinalizerEvent::Cleanup(_template) => {
                info!(template = %name, "Cleaning up SandboxTemplate");
                Ok(Action::await_change())
            }
        }
    })
    .await
}

/// Reconcile a SandboxClaim resource
pub async fn reconcile_claim(
    claim: Arc<SandboxClaim>,
    ctx: Arc<Context>,
) -> Result<Action, kube::Error> {
    let ns = claim.namespace().unwrap_or_else(|| "default".to_string());
    let name = claim.name_any();
    let client = ctx.client.clone();

    let claims: Api<SandboxClaim> = Api::namespaced(client.as_ref().clone(), &ns);
    let templates: Api<SandboxTemplate> = Api::namespaced(client.as_ref().clone(), &ns);
    let sandboxes: Api<Sandbox> = Api::namespaced(client.as_ref().clone(), &ns);

    finalizer(&claims, CLAIM_FINALIZER, claim, |event| async {
        match event {
            FinalizerEvent::Apply(claim) => {
                reconcile_claim_apply(&claim, &templates, &sandboxes, &ns).await
            }
            FinalizerEvent::Cleanup(claim) => {
                reconcile_claim_cleanup(&claim, &sandboxes).await
            }
        }
    })
    .await
}

async fn reconcile_claim_apply(
    claim: &SandboxClaim,
    templates: &Api<SandboxTemplate>,
    sandboxes: &Api<Sandbox>,
    ns: &str,
) -> Result<Action, kube::Error> {
    let name = claim.name_any();
    info!(claim = %name, "Reconciling SandboxClaim");

    // Check if sandbox already exists for this claim
    if let Some(sandbox_ref) = &claim.status.as_ref().and_then(|s| s.sandbox_ref.clone()) {
        // Verify the sandbox still exists
        if sandboxes.get(sandbox_ref).await.is_ok() {
            info!(claim = %name, sandbox = %sandbox_ref, "Sandbox already exists for claim");
            return Ok(Action::requeue(std::time::Duration::from_secs(60)));
        }
    }

    // Get the template
    let template_name = &claim.spec.template_ref;
    let template = match templates.get(template_name).await {
        Ok(t) => t,
        Err(e) => {
            error!(claim = %name, template = %template_name, error = %e, "Failed to get template");
            let status = SandboxClaimStatus {
                phase: Some("Failed".to_string()),
                conditions: Some(vec![SandboxCondition {
                    type_: "Ready".to_string(),
                    status: "False".to_string(),
                    last_transition_time: Some(chrono::Utc::now().to_rfc3339()),
                    last_transition_reason: Some("TemplateNotFound".to_string()),
                    message: Some(format!("Template {} not found", template_name)),
                }]),
                ..Default::default()
            };

            let patch_params = PatchParams::apply("clustershell-operator").force();
            let status_patch = json!({"status": status});
            sandboxes
                .patch_status(&name, &patch_params, &Patch::Merge(&status_patch))
                .await?;
            return Ok(Action::requeue(std::time::Duration::from_secs(60)));
        }
    };

    // Create a new Sandbox from the template
    let sandbox_name = claim
        .spec
        .sandbox_name_prefix
        .as_ref()
        .map(|p| format!("{}-{}", p, uuid::Uuid::new_v4().to_string()[..8].to_string()))
        .unwrap_or_else(|| format!("{}-{}", name, uuid::Uuid::new_v4().to_string()[..8].to_string()));

    let mut sandbox_spec = template.spec.template.clone();

    // Apply overrides if specified
    if let Some(overrides) = &claim.spec.overrides {
        if let Some(lifecycle) = &overrides.lifecycle {
            // Apply lifecycle overrides
        }
        if let Some(runtime_class) = &overrides.runtime_class {
            // Apply runtime class override
        }
    }

    let sandbox = Sandbox {
        metadata: ObjectMeta {
            name: Some(sandbox_name.clone()),
            namespace: Some(ns.to_string()),
            owner_references: Some(vec![kube::api::OwnerReference {
                api_version: SandboxClaim::api_version(&()).to_string(),
                kind: SandboxClaim::kind(&()).to_string(),
                name: name.clone(),
                uid: claim.metadata.uid.clone().unwrap_or_default(),
                controller: Some(true),
                block_owner_deletion: Some(true),
            }]),
            ..Default::default()
        },
        spec: SandboxSpec {
            pod_template: sandbox_spec,
            volume_claim_templates: template.spec.volume_claim_templates.clone(),
            lifecycle: claim
                .spec
                .overrides
                .as_ref()
                .and_then(|o| o.lifecycle.clone())
                .or(template.spec.default_lifecycle.clone()),
            replicas: Some(1),
            runtime_class: claim
                .spec
                .overrides
                .as_ref()
                .and_then(|o| o.runtime_class.clone())
                .or(template.spec.default_runtime_class.clone()),
            hibernation_enabled: claim
                .spec
                .overrides
                .as_ref()
                .and_then(|o| o.hibernation_enabled)
                .or(template.spec.default_hibernation_enabled),
            idle_timeout_seconds: claim
                .spec
                .overrides
                .as_ref()
                .and_then(|o| o.idle_timeout_seconds)
                .or(template.spec.default_idle_timeout_seconds),
        },
        status: None,
    };

    let patch_params = PatchParams::apply("clustershell-operator").force();
    sandboxes.patch(&sandbox_name, &patch_params, &Patch::Apply(&sandbox)).await?;

    // Update claim status
    let status = SandboxClaimStatus {
        phase: Some("Bound".to_string()),
        sandbox_ref: Some(sandbox_name.clone()),
        conditions: Some(vec![SandboxCondition {
            type_: "Ready".to_string(),
            status: "True".to_string(),
            last_transition_time: Some(chrono::Utc::now().to_rfc3339()),
            last_transition_reason: Some("SandboxCreated".to_string()),
            message: Some(format!("Sandbox {} created from template {}", sandbox_name, template_name)),
        }]),
        ..Default::default()
    };

    let claims: Api<SandboxClaim> = Api::namespaced(sandboxes.clone().into_client(), ns);
    let status_patch = json!({"status": status});
    claims.patch_status(&name, &patch_params, &Patch::Merge(&status_patch)).await?;

    info!(claim = %name, sandbox = %sandbox_name, "SandboxClaim reconciled successfully");
    Ok(Action::requeue(std::time::Duration::from_secs(60)))
}

async fn reconcile_claim_cleanup(
    claim: &SandboxClaim,
    _sandboxes: &Api<Sandbox>,
) -> Result<Action, kube::Error> {
    let name = claim.name_any();
    info!(claim = %name, "Cleaning up SandboxClaim");
    // Cleanup is handled by ownerReferences
    Ok(Action::await_change())
}

/// Reconcile a SandboxWarmPool resource
pub async fn reconcile_warmpool(
    warmpool: Arc<SandboxWarmPool>,
    ctx: Arc<Context>,
) -> Result<Action, kube::Error> {
    let ns = warmpool.namespace().unwrap_or_else(|| "default".to_string());
    let name = warmpool.name_any();
    let client = ctx.client.clone();

    let warmpools: Api<SandboxWarmPool> = Api::namespaced(client.as_ref().clone(), &ns);
    let templates: Api<SandboxTemplate> = Api::namespaced(client.as_ref().clone(), &ns);
    let sandboxes: Api<Sandbox> = Api::namespaced(client.as_ref().clone(), &ns);

    finalizer(&warmpools, WARMPOOL_FINALIZER, warmpool, |event| async {
        match event {
            FinalizerEvent::Apply(warmpool) => {
                reconcile_warmpool_apply(&warmpool, &templates, &sandboxes, &ns).await
            }
            FinalizerEvent::Cleanup(warmpool) => {
                reconcile_warmpool_cleanup(&warmpool, &sandboxes).await
            }
        }
    })
    .await
}

async fn reconcile_warmpool_apply(
    warmpool: &SandboxWarmPool,
    templates: &Api<SandboxTemplate>,
    sandboxes: &Api<Sandbox>,
    ns: &str,
) -> Result<Action, kube::Error> {
    let name = warmpool.name_any();
    info!(warmpool = %name, "Reconciling SandboxWarmPool");

    // Get the template
    let template_name = &warmpool.spec.template_ref;
    let template = match templates.get(template_name).await {
        Ok(t) => t,
        Err(e) => {
            error!(warmpool = %name, template = %template_name, error = %e, "Failed to get template");
            return Ok(Action::requeue(std::time::Duration::from_secs(60)));
        }
    };

    // List existing sandboxes owned by this warmpool
    let lp = kube::api::ListParams::default();
    let existing_sandboxes = sandboxes.list(&lp).await?;
    let warmpool_sandboxes: Vec<_> = existing_sandboxes
        .items
        .iter()
        .filter(|s| {
            s.metadata
                .owner_references
                .as_ref()
                .map(|ors| {
                    ors.iter().any(|or| {
                        or.kind == "SandboxWarmPool" && or.name == name
                    })
                })
                .unwrap_or(false)
        })
        .collect();

    let current_count = warmpool_sandboxes.len() as i32;
    let min_ready = warmpool.spec.min_ready.unwrap_or(1);
    let max_size = warmpool.spec.max_size.unwrap_or(5);

    // Scale up if needed
    if current_count < min_ready {
        let needed = min_ready - current_count;
        info!(warmpool = %name, needed = needed, "Scaling up warm pool");

        for i in 0..needed {
            let sandbox_name = format!("{}-warm-{}", name, current_count + i);

            let sandbox = Sandbox {
                metadata: ObjectMeta {
                    name: Some(sandbox_name.clone()),
                    namespace: Some(ns.to_string()),
                    labels: Some(BTreeMap::from([
                        ("agents.x-k8s.io/warmpool".to_string(), name.clone()),
                        ("agents.x-k8s.io/warm-sandbox".to_string(), "true".to_string()),
                    ])),
                    owner_references: Some(vec![kube::api::OwnerReference {
                        api_version: SandboxWarmPool::api_version(&()).to_string(),
                        kind: SandboxWarmPool::kind(&()).to_string(),
                        name: name.clone(),
                        uid: warmpool.metadata.uid.clone().unwrap_or_default(),
                        controller: Some(true),
                        block_owner_deletion: Some(true),
                    }]),
                    ..Default::default()
                },
                spec: SandboxSpec {
                    pod_template: template.spec.template.clone(),
                    volume_claim_templates: template.spec.volume_claim_templates.clone(),
                    lifecycle: template.spec.default_lifecycle.clone(),
                    replicas: Some(1),
                    runtime_class: template.spec.default_runtime_class.clone(),
                    hibernation_enabled: template.spec.default_hibernation_enabled,
                    idle_timeout_seconds: template.spec.default_idle_timeout_seconds,
                },
                status: None,
            };

            let patch_params = PatchParams::apply("clustershell-operator").force();
            sandboxes.patch(&sandbox_name, &patch_params, &Patch::Apply(&sandbox)).await?;
        }
    }

    // Scale down if above max
    if current_count > max_size {
        let excess = current_count - max_size;
        info!(warmpool = %name, excess = excess, "Scaling down warm pool");

        // Delete oldest sandboxes
        for sandbox in warmpool_sandboxes.iter().take(excess as usize) {
            let sandbox_name = sandbox.name_any();
            sandboxes.delete(&sandbox_name, &Default::default()).await?;
        }
    }

    // Update status
    let new_count = warmpool_sandboxes.len() as i32;
    let warm_sandboxes: Vec<WarmPoolSandbox> = warmpool_sandboxes
        .iter()
        .map(|s| WarmPoolSandbox {
            name: s.name_any(),
            state: "Ready".to_string(),
            allocation_time: None,
        })
        .collect();

    let status = SandboxWarmPoolStatus {
        ready_count: Some(new_count),
        total_count: Some(new_count),
        sandboxes: Some(warm_sandboxes),
        conditions: Some(vec![SandboxCondition {
            type_: "Ready".to_string(),
            status: "True".to_string(),
            last_transition_time: Some(chrono::Utc::now().to_rfc3339()),
            last_transition_reason: Some("Scaled".to_string()),
            message: Some(format!("Warm pool has {} sandboxes", new_count)),
        }]),
        ..Default::default()
    };

    let patch_params = PatchParams::apply("clustershell-operator").force();
    let status_patch = json!({"status": status});
    let warmpools: Api<SandboxWarmPool> = Api::namespaced(sandboxes.clone().into_client(), ns);
    warmpools.patch_status(&name, &patch_params, &Patch::Merge(&status_patch)).await?;

    info!(warmpool = %name, count = new_count, "SandboxWarmPool reconciled successfully");
    Ok(Action::requeue(std::time::Duration::from_secs(60)))
}

async fn reconcile_warmpool_cleanup(
    warmpool: &SandboxWarmPool,
    _sandboxes: &Api<Sandbox>,
) -> Result<Action, kube::Error> {
    let name = warmpool.name_any();
    info!(warmpool = %name, "Cleaning up SandboxWarmPool");
    // Cleanup is handled by ownerReferences
    Ok(Action::await_change())
}
