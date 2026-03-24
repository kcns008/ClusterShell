// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! ClusterShell Sandbox - process sandbox and monitor.

use clap::Parser;
use miette::Result;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;
use tracing_subscriber::{Layer, layer::SubscriberExt, util::SubscriberInitExt};

use clustershell_sandbox::run_sandbox;

/// ClusterShell Sandbox - process isolation and monitoring.
#[derive(Parser, Debug)]
#[command(name = "clustershell-sandbox")]
#[command(version = clustershell_core::VERSION)]
#[command(about = "Process sandbox and monitor", long_about = None)]
struct Args {
    /// Command to execute in the sandbox.
    /// Can also be provided via `CLUSTERSHELL_SANDBOX_COMMAND` environment variable.
    /// Defaults to `/bin/bash` if neither is provided.
    #[arg(trailing_var_arg = true)]
    command: Vec<String>,

    /// Working directory for the sandboxed process.
    #[arg(long, short)]
    workdir: Option<String>,

    /// Timeout in seconds (0 = no timeout).
    #[arg(long, short, default_value = "0")]
    timeout: u64,

    /// Run in interactive mode (inherit process group for terminal control).
    #[arg(long, short = 'i')]
    interactive: bool,

    /// Sandbox ID for fetching policy via gRPC from ClusterShell server.
    /// Requires --clustershell-endpoint to be set.
    #[arg(long, env = "CLUSTERSHELL_SANDBOX_ID")]
    sandbox_id: Option<String>,

    /// Sandbox (used for policy sync when the sandbox discovers policy
    /// from disk or falls back to the restrictive default).
    #[arg(long, env = "CLUSTERSHELL_SANDBOX")]
    sandbox: Option<String>,

    /// ClusterShell server gRPC endpoint for fetching policy.
    /// Required when using --sandbox-id.
    #[arg(long, env = "CLUSTERSHELL_ENDPOINT")]
    clustershell_endpoint: Option<String>,

    /// Path to Rego policy file for OPA-based network access control.
    /// Requires --policy-data to also be set.
    #[arg(long, env = "CLUSTERSHELL_POLICY_RULES")]
    policy_rules: Option<String>,

    /// Path to YAML data file containing network policies and sandbox config.
    /// Requires --policy-rules to also be set.
    #[arg(long, env = "CLUSTERSHELL_POLICY_DATA")]
    policy_data: Option<String>,

    /// Log level (trace, debug, info, warn, error).
    #[arg(long, default_value = "warn", env = "CLUSTERSHELL_LOG_LEVEL")]
    log_level: String,

    /// SSH listen address for sandbox access.
    #[arg(long, env = "CLUSTERSHELL_SSH_LISTEN_ADDR")]
    ssh_listen_addr: Option<String>,

    /// Shared secret for gateway-to-sandbox SSH handshake.
    #[arg(long, env = "CLUSTERSHELL_SSH_HANDSHAKE_SECRET")]
    ssh_handshake_secret: Option<String>,

    /// Allowed clock skew for SSH handshake validation.
    #[arg(long, env = "CLUSTERSHELL_SSH_HANDSHAKE_SKEW_SECS", default_value = "300")]
    ssh_handshake_skew_secs: u64,

    /// Path to YAML inference routes for standalone routing.
    /// When set, inference routes are loaded from this file instead of
    /// fetching a bundle from the gateway.
    #[arg(long, env = "CLUSTERSHELL_INFERENCE_ROUTES")]
    inference_routes: Option<String>,

    /// Enable health check endpoint.
    #[arg(long)]
    health_check: bool,

    /// Port for health check endpoint.
    #[arg(long, default_value = "8080")]
    health_port: u16,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    // Try to open a rolling log file; fall back to stdout-only logging if it fails
    // (e.g., /var/log is not writable in custom workload images).
    // Rotates daily, keeps the 3 most recent files to bound disk usage.
    let file_logging = tracing_appender::rolling::RollingFileAppender::builder()
        .rotation(tracing_appender::rolling::Rotation::DAILY)
        .filename_prefix("clustershell")
        .filename_suffix("log")
        .max_log_files(3)
        .build("/var/log")
        .ok()
        .map(|roller| {
            let (writer, guard) = tracing_appender::non_blocking(roller);
            (writer, guard)
        });

    let stdout_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(&args.log_level));

    // Install rustls crypto provider before any TLS connections (including log push).
    let _ = rustls::crypto::ring::default_provider().install_default();

    // Set up optional log push layer (gRPC mode only).
    let log_push_state = if let (Some(sandbox_id), Some(endpoint)) =
        (&args.sandbox_id, &args.clustershell_endpoint)
    {
        let (tx, handle) =
            clustershell_sandbox::log_push::spawn_log_push_task(endpoint.clone(), sandbox_id.clone());
        let layer = clustershell_sandbox::log_push::LogPushLayer::new(sandbox_id.clone(), tx);
        Some((layer, handle))
    } else {
        None
    };
    let push_layer = log_push_state.as_ref().map(|(layer, _)| layer.clone());
    let _log_push_handle = log_push_state.map(|(_, handle)| handle);

    // Keep the file guard alive for the entire process. When the guard is
    // dropped the non-blocking writer flushes remaining logs.
    let _file_guard = if let Some((file_writer, file_guard)) = file_logging {
        let file_filter = EnvFilter::new("info");
        tracing_subscriber::registry()
            .with(
                tracing_subscriber::fmt::layer()
                    .with_writer(std::io::stdout)
                    .with_filter(stdout_filter),
            )
            .with(
                tracing_subscriber::fmt::layer()
                    .with_writer(file_writer)
                    .with_ansi(false)
                    .with_filter(file_filter),
            )
            .with(push_layer.clone())
            .init();
        Some(file_guard)
    } else {
        tracing_subscriber::registry()
            .with(
                tracing_subscriber::fmt::layer()
                    .with_writer(std::io::stdout)
                    .with_filter(stdout_filter),
            )
            .with(push_layer)
            .init();
        // Log the warning after the subscriber is initialized
        warn!("Could not open /var/log for log rotation; using stdout-only logging");
        None
    };

    // Get command - either from CLI args, environment variable, or default to /bin/bash
    let command = if !args.command.is_empty() {
        args.command
    } else if let Ok(c) = std::env::var("CLUSTERSHELL_SANDBOX_COMMAND") {
        // Simple shell-like splitting on whitespace
        c.split_whitespace().map(String::from).collect()
    } else {
        vec!["/bin/bash".to_string()]
    };

    info!(command = ?command, "Starting sandbox");

    let exit_code = run_sandbox(
        command,
        args.workdir,
        args.timeout,
        args.interactive,
        args.sandbox_id,
        args.sandbox,
        args.clustershell_endpoint,
        args.policy_rules,
        args.policy_data,
        args.ssh_listen_addr,
        args.ssh_handshake_secret,
        args.ssh_handshake_skew_secs,
        args.health_check,
        args.health_port,
        args.inference_routes,
    )
    .await?;

    std::process::exit(exit_code);
}
