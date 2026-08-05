import 'server-only';

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

// Thin JSON-RPC 2.0 client over the long-lived `nokv mcp` stdio subprocess.
// NoKV has no JS SDK and a private msgpack-over-TCP wire protocol; the MCP
// server is the sanctioned non-Rust client surface.
//
// Failure policy:
// - Transport failures (spawn, timeout, process exit) disable the client for
//   30s and resolve as null; they must NEVER surface to user-facing routes.
// - Tool-level errors (result.isError) throw NokvToolError so the domain
//   layer can implement contract semantics (PathExists-as-success, retries).

const REQUIRED_VARS = [
  'NOKV_BIN',
  'NOKV_ROOT_ID',
  'NOKV_ETCD_ENDPOINT',
  'NOKV_ETCD_KEY_PREFIX',
  'NOKV_OBJECT_ENDPOINT',
  'NOKV_OBJECT_BUCKET',
  'NOKV_OBJECT_ROOT',
  'NOKV_OBJECT_REGION',
  'NOKV_OBJECT_ACCESS_KEY_ID',
  'NOKV_OBJECT_SECRET_ACCESS_KEY',
  'NOKV_WORKBENCH_ROOT',
  'NOKV_SESSION_SECRET'
] as const;

const CALL_TIMEOUT_MS = 5_000;
const RUNTIME_DISABLE_MS = 30_000;

export class NokvToolError extends Error {}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

interface McpState {
  proc: ChildProcessWithoutNullStreams;
  pending: Map<number, Pending>;
  nextId: number;
  ready: Promise<void>;
}

interface NokvGlobal {
  __nokvMcp?: McpState;
  __nokvDisabledUntil?: number;
}

const g = globalThis as unknown as NokvGlobal;

let enabledMemo: boolean | null = null;

export function isNokvEnabled(): boolean {
  if (enabledMemo === null) {
    enabledMemo =
      process.env.NOKV_ENABLED === 'true' &&
      REQUIRED_VARS.every((v) => !!process.env[v]);
  }
  return enabledMemo;
}

/** Connection/routing argv shared by the resident MCP subprocess and the
 *  one-shot blob CLI channel (collect/materialize). */
export function connArgv(): string[] {
  const e = process.env;
  return [
    '--root-id',
    e.NOKV_ROOT_ID!,
    '--etcd-endpoint',
    e.NOKV_ETCD_ENDPOINT!,
    '--etcd-key-prefix',
    e.NOKV_ETCD_KEY_PREFIX!,
    '--object-bucket',
    e.NOKV_OBJECT_BUCKET!,
    '--object-endpoint',
    e.NOKV_OBJECT_ENDPOINT!,
    '--object-root',
    e.NOKV_OBJECT_ROOT!,
    '--object-region',
    e.NOKV_OBJECT_REGION!,
    '--object-access-key-id',
    e.NOKV_OBJECT_ACCESS_KEY_ID!,
    '--object-secret-access-key',
    e.NOKV_OBJECT_SECRET_ACCESS_KEY!,
    '--workbench-root',
    e.NOKV_WORKBENCH_ROOT!
  ];
}

function mcpArgv(): string[] {
  return [...connArgv(), 'mcp'];
}

function markRuntimeDisabled(reason: unknown) {
  // eslint-disable-next-line no-console
  console.error('[nokv] runtime disabled for 30s:', reason);
  g.__nokvDisabledUntil = Date.now() + RUNTIME_DISABLE_MS;
  const state = g.__nokvMcp;
  g.__nokvMcp = undefined;
  if (state) {
    for (const p of state.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('nokv mcp shut down'));
    }
    state.pending.clear();
    try {
      state.proc.kill();
    } catch {
      /* already gone */
    }
  }
}

function startProcess(): McpState {
  const proc = spawn(process.env.NOKV_BIN!, mcpArgv(), {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const state: McpState = {
    proc,
    pending: new Map(),
    nextId: 1,
    ready: Promise.resolve()
  };

  const rl = createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg: {
      id?: number;
      result?: unknown;
      error?: { message?: string };
    };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof msg.id !== 'number') return;
    const pending = state.pending.get(msg.id);
    if (!pending) return;
    state.pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.error) {
      pending.reject(
        new NokvToolError(msg.error.message ?? 'nokv mcp rpc error')
      );
    } else {
      pending.resolve(msg.result);
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    // eslint-disable-next-line no-console
    console.error('[nokv mcp]', chunk.toString().trim());
  });

  proc.on('error', markRuntimeDisabled);
  proc.on('exit', (code) =>
    markRuntimeDisabled(new Error(`nokv mcp exited with code ${code}`))
  );

  const send = (payload: Record<string, unknown>) => {
    proc.stdin.write(JSON.stringify(payload) + '\n');
  };

  state.ready = rpc(state, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'echojournal', version: '0.1.0' }
  }).then(() => {
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  });

  return state;
}

function rpc(
  state: McpState,
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number = CALL_TIMEOUT_MS
): Promise<unknown> {
  const id = state.nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      reject(new Error(`nokv mcp timeout: ${method}`));
    }, timeoutMs);
    state.pending.set(id, { resolve, reject, timer });
    state.proc.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
    );
  });
}

interface ToolResult {
  isError?: boolean;
  structuredContent?: unknown;
  content?: Array<{ type: string; text?: string }>;
}

/**
 * Calls a workbench tool. Returns the tool's structured content, or null when
 * NoKV is disabled (by config or runtime backoff) or the transport failed.
 * Throws NokvToolError for tool-level failures so callers can apply contract
 * semantics.
 */
export async function callWorkbenchTool(
  name: string,
  args: Record<string, unknown>,
  opts?: { timeoutMs?: number }
): Promise<unknown | null> {
  if (!isNokvEnabled()) return null;
  if (g.__nokvDisabledUntil && Date.now() < g.__nokvDisabledUntil) return null;

  let state = g.__nokvMcp;
  try {
    if (!state) {
      state = startProcess();
      g.__nokvMcp = state;
    }
    await state.ready;
  } catch (err) {
    markRuntimeDisabled(err);
    return null;
  }

  let result: ToolResult;
  try {
    result = (await rpc(
      state,
      'tools/call',
      { name, arguments: args },
      opts?.timeoutMs
    )) as ToolResult;
  } catch (err) {
    if (err instanceof NokvToolError) throw err;
    markRuntimeDisabled(err);
    return null;
  }

  if (result?.isError) {
    const text =
      result.content?.map((c) => c.text ?? '').join(' ') ??
      JSON.stringify(result).slice(0, 300);
    throw new NokvToolError(text);
  }
  return result?.structuredContent ?? result;
}
