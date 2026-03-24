// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! ClusterShell Kubernetes Operator
//!
//! This operator manages Sandbox CRDs compatible with the kubernetes-sigs/agent-sandbox
//! specification, providing:
//! - Sandbox CRD: Singleton, stateful workloads with stable identity
//! - SandboxTemplate CRD: Reusable templates for sandbox creation
//! - SandboxClaim CRD: Abstracted sandbox allocation
//! - SandboxWarmPool CRD: Pre-warmed sandbox pools for fast allocation

use std::sync::Arc;

use anyhow::Result;
use kube::runtime::watcher::Config as WatcherConfig;
use kube::runtime::{Controller, WatchStreamExt, controller::Action};
use kube::{Api, Client, ResourceExt};
use tracing::{error, info, warn};

mod crd;
mod controller;

use crd::{Sandbox, SandboxClaim, SandboxTemplate, SandboxWarmPool};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::init();

    info!("Starting ClusterShell Kubernetes Operator");

    let client = Client::try_default().await?;
    let client = Arc::new(client);

    // Run controllers for each CRD
    let sandbox_controller = run_sandbox_controller(client.clone());
    let template_controller = run_template_controller(client.clone());
    let claim_controller = run_claim_controller(client.clone());
    let warmpool_controller = run_warmpool_controller(client.clone());

    tokio::select! {
        result = sandbox_controller => {
            if let Err(e) = result {
                error!(error = %e, "Sandbox controller failed");
            }
        }
        result = template_controller => {
            if let Err(e) = result {
                error!(error = %e, "SandboxTemplate controller failed");
            }
        }
        result = claim_controller => {
            if let Err(e) = result {
                error!(error = %e, "SandboxClaim controller failed");
            }
        }
        result = warmpool_controller => {
            if let Err(e) = result {
                error!(error = %e, "SandboxWarmPool controller failed");
            }
        }
    }

    Ok(())
}

async fn run_sandbox_controller(client: Arc<Client>) -> Result<()> {
    let sandboxes: Api<Sandbox> = Api::all(client.as_ref().clone());

    Controller::new(sandboxes, WatcherConfig::default())
        .run(
            controller::reconcile_sandbox,
            controller::error_policy,
            Arc::new(controller::Context { client: client.clone() }),
        )
        .for_each(|res| async move {
            match res {
                Ok((sandbox, _)) => {
                    info!(name = %sandbox.name_any(), namespace = %sandbox.namespace().unwrap_or_default(), "Reconciled Sandbox");
                }
                Err(e) => {
                    error!(error = %e, "Failed to reconcile Sandbox");
                }
            }
        })
        .await;

    Ok(())
}

async fn run_template_controller(client: Arc<Client>) -> Result<()> {
    let templates: Api<SandboxTemplate> = Api::all(client.as_ref().clone());

    Controller::new(templates, WatcherConfig::default())
        .run(
            controller::reconcile_template,
            controller::error_policy,
            Arc::new(controller::Context { client: client.clone() }),
        )
        .for_each(|res| async move {
            match res {
                Ok((template, _)) => {
                    info!(name = %template.name_any(), "Reconciled SandboxTemplate");
                }
                Err(e) => {
                    error!(error = %e, "Failed to reconcile SandboxTemplate");
                }
            }
        })
        .await;

    Ok(())
}

async fn run_claim_controller(client: Arc<Client>) -> Result<()> {
    let claims: Api<SandboxClaim> = Api::all(client.as_ref().clone());
    let sandboxes: Api<Sandbox> = Api::all(client.as_ref().clone());

    Controller::new(claims, WatcherConfig::default())
        .watches(
            sandboxes,
            WatcherConfig::default(),
            controller::sandbox_claim_mapper,
        )
        .run(
            controller::reconcile_claim,
            controller::error_policy,
            Arc::new(controller::Context { client: client.clone() }),
        )
        .for_each(|res| async move {
            match res {
                Ok((claim, _)) => {
                    info!(name = %claim.name_any(), "Reconciled SandboxClaim");
                }
                Err(e) => {
                    error!(error = %e, "Failed to reconcile SandboxClaim");
                }
            }
        })
        .await;

    Ok(())
}

async fn run_warmpool_controller(client: Arc<Client>) -> Result<()> {
    let warmpools: Api<SandboxWarmPool> = Api::all(client.as_ref().clone());
    let sandboxes: Api<Sandbox> = Api::all(client.as_ref().clone());

    Controller::new(warmpools, WatcherConfig::default())
        .watches(
            sandboxes,
            WatcherConfig::default(),
            controller::sandbox_warmpool_mapper,
        )
        .run(
            controller::reconcile_warmpool,
            controller::error_policy,
            Arc::new(controller::Context { client: client.clone() }),
        )
        .for_each(|res| async move {
            match res {
                Ok((warmpool, _)) => {
                    info!(name = %warmpool.name_any(), "Reconciled SandboxWarmPool");
                }
                Err(e) => {
                    error!(error = %e, "Failed to reconcile SandboxWarmPool");
                }
            }
        })
        .await;

    Ok(())
}
