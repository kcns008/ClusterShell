import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

// Map template IDs to the agent startup command
const AGENT_CMDS: Record<string, string> = {
  opencode: 'opencode',
  'claude-code': 'claude',
  aider: 'aider',
  devika: 'devika',
  copilot: 'gh',
};

interface AgentShellProps {
  namespace: string;
  podName: string;
  container?: string;
  /** Template label value from clustershell.io/template — determines which agent to launch */
  template?: string;
  onClose?: () => void;
}

/**
 * AgentShell — connects to a pod via WebSocket exec and optionally launches the
 * agent process directly (based on the pod's template label).
 *
 * The backend proxies the WebSocket to the Kubernetes exec API using SPDY.
 * Passing `cmd=<agent>` instructs the executor to exec the agent binary instead of
 * the default shell, so the user lands directly in the agent's interactive UI.
 */
export function AgentShell({ namespace, podName, container, template, onClose }: AgentShellProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const connect = useCallback(() => {
    if (!termRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: '#0a0c10',
        foreground: '#cdd9e5',
        cursor: '#539bf5',
        cursorAccent: '#0a0c10',
        selectionBackground: '#204060',
        black: '#1c2128',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#539bf5',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#cdd9e5',
        brightBlack: '#636e7b',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#80bfff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Build WebSocket URL — pass cmd param for direct agent launch
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const containerParam = container ? `&container=${encodeURIComponent(container)}` : '';
    const agentCmd = template ? AGENT_CMDS[template] : undefined;
    const cmdParam = agentCmd ? `&cmd=${encodeURIComponent(agentCmd)}` : '';
    const wsUrl = `${wsProtocol}//${window.location.host}/terminal/exec?namespace=${encodeURIComponent(namespace)}&pod=${encodeURIComponent(podName)}${containerParam}${cmdParam}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const agentLabel = template && AGENT_CMDS[template] ? ` → launching \x1b[33m${AGENT_CMDS[template]}\x1b[0m` : '';
      xterm.writeln(`\x1b[32m● Connected\x1b[0m  \x1b[2m${namespace}/${podName}\x1b[0m${agentLabel}\r\n`);
      ws.send(JSON.stringify({ type: 'resize', cols: xterm.cols, rows: xterm.rows }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'stdout') {
          xterm.write(data.data);
        } else if (data.type === 'error') {
          xterm.writeln(`\r\n\x1b[31m✗ Error: ${data.data}\x1b[0m`);
        }
      } catch {
        // binary / raw data
        xterm.write(event.data);
      }
    };

    ws.onerror = () => {
      xterm.writeln('\r\n\x1b[31m✗ Connection error — check that the pod is Running\x1b[0m');
    };

    ws.onclose = (event) => {
      xterm.writeln(`\r\n\x1b[33m● Session ended  (code: ${event.code})\x1b[0m`);
    };

    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stdin', data }));
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: xterm.cols, rows: xterm.rows }));
      }
    };

    const ro = new ResizeObserver(handleResize);
    if (termRef.current) ro.observe(termRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, [namespace, podName, container, template]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      wsRef.current?.close();
      xtermRef.current?.dispose();
      fitAddonRef.current = null;
      cleanup?.();
    };
  }, [connect]);

  const reconnect = () => {
    wsRef.current?.close();
    xtermRef.current?.dispose();
    connect();
  };

  const agentLabel = template && AGENT_CMDS[template] ? AGENT_CMDS[template] : 'shell';

  return (
    <div className="flex flex-col h-full bg-[#0a0c10] overflow-hidden">
      {/* Shell header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#2d3748] shrink-0">
        <div className="flex items-center gap-3">
          {/* macOS-style traffic lights */}
          <div className="flex gap-1.5">
            <div
              className="w-3 h-3 rounded-full bg-[#ff5f56] hover:brightness-110 cursor-pointer transition"
              onClick={onClose}
              title="Close"
            />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" title="Minimize" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" title="Full screen" />
          </div>
          <span className="text-xs text-[#539bf5] font-mono font-semibold">{agentLabel}</span>
          <span className="text-xs text-[#636e7b] font-mono">
            {namespace}/{podName}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={reconnect}
            className="text-xs px-2.5 py-1 text-[#8b949e] hover:text-white hover:bg-[#2d3748] rounded transition font-medium"
          >
            Reconnect
          </button>
          <button
            onClick={onClose}
            className="text-xs px-2.5 py-1 text-[#8b949e] hover:text-white hover:bg-[#2d3748] rounded transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
      {/* xterm.js container */}
      <div ref={termRef} className="flex-1 min-h-0 p-1" />
    </div>
  );
}
