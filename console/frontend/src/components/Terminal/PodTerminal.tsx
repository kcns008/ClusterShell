import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface PodTerminalProps {
  namespace: string;
  podName: string;
  container?: string;
  onClose?: () => void;
}

/**
 * Terminal component that connects to a pod via WebSocket exec.
 * Pattern based on OpenShift Console's implementation:
 * - Backend proxies WebSocket to Kubernetes exec API
 * - Frontend renders via xterm.js
 * - Resize events sent back to keep TTY in sync
 */
export function PodTerminal({ namespace, podName, container, onClose }: PodTerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!termRef.current) return;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;

    // Connect to backend WebSocket proxy
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const containerParam = container ? `&container=${container}` : '';
    const ws = new WebSocket(
      `${wsProtocol}//${window.location.host}/terminal/exec?namespace=${namespace}&pod=${podName}${containerParam}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      xterm.writeln('\x1b[32mConnected to pod: ' + podName + '\x1b[0m\r\n');
      // Send initial resize
      ws.send(JSON.stringify({
        type: 'resize',
        cols: xterm.cols,
        rows: xterm.rows,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'stdout') {
        xterm.write(data.data);
      } else if (data.type === 'error') {
        xterm.writeln(`\r\n\x1b[31mError: ${data.data}\x1b[0m`);
      }
    };

    ws.onerror = () => {
      xterm.writeln('\r\n\x1b[31mConnection error\x1b[0m');
    };

    ws.onclose = (event) => {
      xterm.writeln(`\r\n\x1b[33mDisconnected (code: ${event.code})\x1b[0m`);
    };

    // Send user input to backend
    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stdin', data }));
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: xterm.cols,
          rows: xterm.rows,
        }));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [namespace, podName, container]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      wsRef.current?.close();
      xtermRef.current?.dispose();
      cleanup?.();
    };
  }, [connect]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-lg overflow-hidden border border-gray-700">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 cursor-pointer" onClick={onClose} />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="ml-3 text-sm text-gray-400 font-mono">
            {namespace}/{podName}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => wsRef.current?.close()}
            className="text-xs px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          >
            Reconnect
          </button>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          >
            Close
          </button>
        </div>
      </div>
      {/* xterm.js container */}
      <div ref={termRef} className="flex-1 p-2" />
    </div>
  );
}
