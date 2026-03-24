// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

//! CLI binary resolution for e2e tests.
//!
//! Resolves the `clustershell` binary at `<workspace>/target/debug/clustershell`.
//! The binary must already be built — the `e2e:rust` mise task handles
//! this by running `cargo build -p clustershell-cli` before the tests.

use std::path::{Path, PathBuf};

/// Locate the workspace root by walking up from the crate's manifest directory.
fn workspace_root() -> PathBuf {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    // e2e/rust/ is two levels below the workspace root.
    manifest_dir
        .ancestors()
        .nth(2)
        .expect("failed to resolve workspace root from CARGO_MANIFEST_DIR")
        .to_path_buf()
}

/// Return the path to the `clustershell` CLI binary.
///
/// Expects the binary at `<workspace>/target/debug/clustershell`.
///
/// # Panics
///
/// Panics if the binary is not found. Run `cargo build -p clustershell-cli`
/// (or `mise run e2e:rust`) first.
pub fn clustershell_bin() -> PathBuf {
    let bin = workspace_root().join("target/debug/clustershell");
    assert!(
        bin.is_file(),
        "clustershell binary not found at {bin:?} — run `cargo build -p clustershell-cli` first"
    );
    bin
}

/// Create a [`tokio::process::Command`] pre-configured to invoke the
/// `clustershell` CLI.
///
/// The command has `kill_on_drop(true)` set so that background child processes
/// are cleaned up when the handle is dropped.
pub fn clustershell_cmd() -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(clustershell_bin());
    cmd.kill_on_drop(true);
    cmd
}

fn shell_escape(arg: &str) -> String {
    if arg
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || "-_./:@".contains(c))
    {
        return arg.to_string();
    }

    format!("'{}'", arg.replace('\'', "'\\''"))
}

/// Create a [`tokio::process::Command`] that runs `clustershell` under a PTY.
pub fn clustershell_tty_cmd(args: &[&str]) -> tokio::process::Command {
    let bin = clustershell_bin();
    let mut cmd = tokio::process::Command::new("script");

    if cfg!(target_os = "macos") {
        cmd.arg("-q").arg("/dev/null").arg(bin).args(args);
    } else {
        let mut shell_command = shell_escape(bin.to_str().expect("clustershell path is utf-8"));
        for arg in args {
            shell_command.push(' ');
            shell_command.push_str(&shell_escape(arg));
        }
        cmd.arg("-q")
            .arg("-e")
            .arg("-c")
            .arg(shell_command)
            .arg("/dev/null");
    }

    cmd.kill_on_drop(true);
    cmd
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workspace_root_resolves() {
        let root = workspace_root();
        assert!(
            root.join("Cargo.toml").is_file(),
            "workspace root should contain Cargo.toml: {root:?}"
        );
    }
}
