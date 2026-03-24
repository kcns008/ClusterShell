// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! CLI smoke tests that verify command structure and graceful error handling.
//!
//! These tests do NOT require a running gateway — they exercise the CLI binary
//! directly, validating that the restructured command tree parses correctly and
//! handles edge cases like missing gateway configuration.

use std::process::Stdio;

use clustershell_e2e::harness::binary::clustershell_cmd;
use clustershell_e2e::harness::output::strip_ansi;

/// Run `clustershell <args>` with an isolated (empty) config directory so it
/// cannot discover any real gateway.
async fn run_isolated(args: &[&str]) -> (String, i32) {
    let tmpdir = tempfile::tempdir().expect("create isolated config dir");
    let mut cmd = clustershell_cmd();
    cmd.args(args)
        .env("XDG_CONFIG_HOME", tmpdir.path())
        .env("HOME", tmpdir.path())
        .env_remove("CLUSTERSHELL_GATEWAY")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = cmd.output().await.expect("spawn clustershell");
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{stdout}{stderr}");
    let code = output.status.code().unwrap_or(-1);
    (combined, code)
}

// -------------------------------------------------------------------
// Top-level --help shows the restructured command tree
// -------------------------------------------------------------------

/// `clustershell --help` must list the new top-level commands: gateway, status,
/// forward, logs, policy.
#[tokio::test]
async fn help_shows_restructured_commands() {
    let (output, code) = run_isolated(&["--help"]).await;
    assert_eq!(code, 0, "clustershell --help should exit 0");

    let clean = strip_ansi(&output);
    for cmd in ["gateway", "status", "sandbox", "forward", "logs", "policy"] {
        assert!(
            clean.contains(cmd),
            "expected '{cmd}' in --help output:\n{clean}"
        );
    }
}

/// `clustershell gateway --help` must list start, stop, destroy, select, info.
#[tokio::test]
async fn gateway_help_shows_subcommands() {
    let (output, code) = run_isolated(&["gateway", "--help"]).await;
    assert_eq!(code, 0, "clustershell gateway --help should exit 0");

    let clean = strip_ansi(&output);
    for sub in ["start", "stop", "destroy", "select", "info"] {
        assert!(
            clean.contains(sub),
            "expected '{sub}' in gateway --help output:\n{clean}"
        );
    }
}

/// `clustershell sandbox --help` must list upload and download alongside create,
/// get, list, delete, connect.
#[tokio::test]
async fn sandbox_help_shows_upload_download() {
    let (output, code) = run_isolated(&["sandbox", "--help"]).await;
    assert_eq!(code, 0, "clustershell sandbox --help should exit 0");

    let clean = strip_ansi(&output);
    for sub in ["upload", "download", "create", "get", "list", "delete", "connect"] {
        assert!(
            clean.contains(sub),
            "expected '{sub}' in sandbox --help output:\n{clean}"
        );
    }
}

/// `clustershell sandbox create --help` must show `--gpu`, `--upload`,
/// `--no-git-ignore`, `--no-bootstrap`, `--editor`, and
/// `--auto-providers`/`--no-auto-providers`.
/// Note: `--bootstrap` is intentionally hidden (it's the default behaviour).
#[tokio::test]
async fn sandbox_create_help_shows_new_flags() {
    let (output, code) = run_isolated(&["sandbox", "create", "--help"]).await;
    assert_eq!(code, 0, "clustershell sandbox create --help should exit 0");

    let clean = strip_ansi(&output);
    for flag in [
        "--gpu",
        "--upload",
        "--no-git-ignore",
        "--no-bootstrap",
        "--editor",
        "--auto-providers",
        "--no-auto-providers",
    ] {
        assert!(
            clean.contains(flag),
            "expected '{flag}' in sandbox create --help:\n{clean}"
        );
    }
}

/// `clustershell sandbox connect --help` must show `--editor`.
#[tokio::test]
async fn sandbox_connect_help_shows_editor_flag() {
    let (output, code) = run_isolated(&["sandbox", "connect", "--help"]).await;
    assert_eq!(code, 0, "clustershell sandbox connect --help should exit 0");

    let clean = strip_ansi(&output);
    assert!(
        clean.contains("--editor"),
        "expected '--editor' in sandbox connect --help:\n{clean}"
    );
}

/// `clustershell gateway start --help` must show `--recreate`.
#[tokio::test]
async fn gateway_start_help_shows_recreate() {
    let (output, code) = run_isolated(&["gateway", "start", "--help"]).await;
    assert_eq!(code, 0, "clustershell gateway start --help should exit 0");

    let clean = strip_ansi(&output);
    assert!(
        clean.contains("--recreate"),
        "expected '--recreate' in gateway start --help:\n{clean}"
    );
}

// -------------------------------------------------------------------
// Graceful handling: `clustershell status` without a gateway
// -------------------------------------------------------------------

/// `clustershell status` with no gateway configured should exit 0 and print a
/// friendly message instead of erroring.
#[tokio::test]
async fn status_without_gateway_prints_friendly_message() {
    let (output, code) = run_isolated(&["status"]).await;
    assert_eq!(
        code, 0,
        "clustershell status should exit 0 even without a gateway, got output:\n{output}"
    );

    let clean = strip_ansi(&output);
    assert!(
        clean.contains("No gateway configured"),
        "expected 'No gateway configured' in status output:\n{clean}"
    );
    assert!(
        clean.contains("clustershell gateway start"),
        "expected hint to run 'clustershell gateway start':\n{clean}"
    );
}
