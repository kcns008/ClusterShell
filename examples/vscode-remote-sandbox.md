# Open VSCode in a Sandbox

Connect VSCode to a running sandbox using the
[Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)
extension so you get a full IDE experience inside the sandbox environment.

## Prerequisites

- A running clustershell gateway (`clustershell gateway start`)
- [VSCode](https://code.visualstudio.com/) with the
  [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)
  extension installed
- The `clustershell` CLI on your `PATH`

## Quick start

### 1. Create and open the sandbox in VS Code

```bash
clustershell sandbox create --editor vscode --name my-sandbox
```

This launches VS Code directly into `/sandbox`, keeps the sandbox alive for the
remote session, and installs an ClusterShell-managed SSH include file so your main
`~/.ssh/config` stays clean.

### 2. Reconnect later

To reopen an existing sandbox in VS Code:

```bash
clustershell sandbox connect my-sandbox --editor vscode
```

ClusterShell maintains the generated `Host clustershell-my-sandbox` entry in its own
managed SSH config include file.

### 3. Optional manual workflow

If you want to inspect the generated SSH stanza directly:

```text
Host clustershell-my-sandbox
    User sandbox
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    GlobalKnownHostsFile /dev/null
    LogLevel ERROR
    ProxyCommand clustershell ssh-proxy --gateway <gateway-name> --name my-sandbox
```

You can still print it manually with:

```bash
clustershell sandbox ssh-config my-sandbox
```

### 4. Open VS Code manually

Open VSCode and run **Remote-SSH: Connect to Host...** from the command
palette (`Cmd+Shift+P` / `Ctrl+Shift+P`). Select `clustershell-my-sandbox` from the
list. VSCode will open a remote window connected to the sandbox.

Alternatively, from the terminal:

```bash
code --remote ssh-remote+clustershell-my-sandbox /sandbox
```

### 5. Clean up

When you are done, delete the sandbox:

```bash
clustershell sandbox delete my-sandbox
```

This also removes any active port forwards.
