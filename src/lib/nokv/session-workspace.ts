import 'server-only';

import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual
} from 'node:crypto';
import { callWorkbenchTool, isNokvEnabled, NokvToolError } from './mcp-client';

// Domain layer: one voice-agent session = one NoKV workbench.
//   metadata/session.json   - immutable session metadata (create-only)
//   logs/tool_calls.jsonl   - ordered tool-call trace (append, generation CAS)
//   outputs/final_message.md- client-reported last reply (create-only)
//   commit                  - deterministic manifest; replays are idempotent
// Every function is a silent no-op when NoKV is disabled or refs don't verify.

const WB_ID_RE = /^[A-Za-z0-9_-]+$/;
const MAX_WB_ID_BYTES = 128;
const MAX_FINAL_MESSAGE_CHARS = 8192;

export interface SessionMeta {
  voice: string;
  model: string;
  startedAt: string;
}

export interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  resultSummary: Record<string, unknown>;
  durationMs: number;
}

function hmacSig(userId: string, wbId: string): string {
  return createHmac('sha256', process.env.NOKV_SESSION_SECRET!)
    .update(`${userId}:${wbId}`)
    .digest('hex')
    .slice(0, 32);
}

/** Stable JSON: recursively sorted keys, compact separators. Matches the
 *  canonical form NoKV uses for content digests. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Mints `wbId.hmac` for a new session, or null when NoKV is off or the id
 *  would violate the workbench id contract (fail closed, never escape). */
export function mintSessionRef(userId: string): string | null {
  if (!isNokvEnabled()) return null;
  const wbId = `vs-${userId}-${randomUUID()}`;
  if (!WB_ID_RE.test(wbId) || Buffer.byteLength(wbId) > MAX_WB_ID_BYTES) {
    return null;
  }
  return `${wbId}.${hmacSig(userId, wbId)}`;
}

/** Returns the workbench id when the ref belongs to this user, else null. */
export function verifySessionRef(
  userId: string,
  sessionRef: string | null | undefined
): string | null {
  if (!isNokvEnabled() || !sessionRef) return null;
  const dot = sessionRef.lastIndexOf('.');
  if (dot <= 0) return null;
  const wbId = sessionRef.slice(0, dot);
  const mac = sessionRef.slice(dot + 1);
  if (!WB_ID_RE.test(wbId) || Buffer.byteLength(wbId) > MAX_WB_ID_BYTES) {
    return null;
  }
  const expected = hmacSig(userId, wbId);
  if (mac.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return wbId;
}

const isAlreadyExists = (err: unknown) =>
  err instanceof NokvToolError && /already.?exists/i.test(err.message);
const isPathExists = (err: unknown) =>
  err instanceof NokvToolError &&
  /path.?exists|already.?exists/i.test(err.message);
const isNotFound = (err: unknown) =>
  err instanceof NokvToolError && /not.?found/i.test(err.message);
const isCasConflict = (err: unknown) =>
  err instanceof NokvToolError &&
  /generation|conflict|precondition/i.test(err.message);

export async function createSessionWorkspace(
  userId: string,
  sessionRef: string,
  meta: SessionMeta
): Promise<void> {
  const wbId = verifySessionRef(userId, sessionRef);
  if (!wbId) return;

  try {
    await callWorkbenchTool('workbench_create', { id: wbId });
  } catch (err) {
    if (!isAlreadyExists(err)) {
      // eslint-disable-next-line no-console
      console.error('[nokv] workbench_create failed', err);
      return;
    }
  }

  try {
    await callWorkbenchTool('workbench_put_file', {
      id: wbId,
      section: 'metadata',
      path: 'session.json',
      text: canonicalJson({
        schema: 'echojournal.voice_session.v1',
        user_id: userId,
        voice_id: meta.voice,
        model: meta.model,
        started_at: meta.startedAt
      }),
      content_type: 'application/json',
      replace: false
    });
  } catch (err) {
    if (!isPathExists(err)) {
      // eslint-disable-next-line no-console
      console.error('[nokv] session.json put failed', err);
    }
  }
}

export async function appendToolCall(
  userId: string,
  sessionRef: string,
  record: ToolCallRecord
): Promise<void> {
  const wbId = verifySessionRef(userId, sessionRef);
  if (!wbId) return;

  const args = {
    id: wbId,
    section: 'logs',
    path: 'tool_calls.jsonl',
    text:
      JSON.stringify({
        schema: 'echojournal.voice_session.toolcall.v1',
        tool: record.tool,
        args: record.args,
        result_summary: record.resultSummary,
        duration_ms: record.durationMs,
        ts: new Date().toISOString()
      }) + '\n'
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await callWorkbenchTool('workbench_append', args);
      return;
    } catch (err) {
      // after() ordering is not guaranteed: the append can land before create.
      if (isNotFound(err) && attempt === 0) {
        try {
          await callWorkbenchTool('workbench_create', { id: wbId });
        } catch {
          /* AlreadyExists or transport failure; retry decides */
        }
        continue;
      }
      if (isCasConflict(err) && attempt < 2) continue;
      // eslint-disable-next-line no-console
      console.error('[nokv] append tool call failed', err);
      return;
    }
  }
}

export async function commitSession(
  userId: string,
  sessionRef: string,
  opts: { lastMessage?: string; endedReason?: string }
): Promise<void> {
  const wbId = verifySessionRef(userId, sessionRef);
  if (!wbId) return;

  const message = (opts.lastMessage ?? '').slice(0, MAX_FINAL_MESSAGE_CHARS);
  const messageSha = createHash('sha256').update(message, 'utf8').digest('hex');

  try {
    await callWorkbenchTool('workbench_put_file', {
      id: wbId,
      section: 'outputs',
      path: 'final_message.md',
      text: message,
      content_type: 'text/markdown',
      replace: false
    });
  } catch (err) {
    if (!isPathExists(err)) {
      // eslint-disable-next-line no-console
      console.error('[nokv] final_message put failed', err);
    }
  }

  // Deterministic commit identity: no timestamps, request-derived fields only,
  // so replaying the same session end is an idempotent_replay on the server.
  const manifest = {
    schema: 'echojournal.voice_session.run.v1',
    workbench_id: wbId,
    final_message_sha256: messageSha,
    ended_reason: opts.endedReason ?? 'user_disconnect',
    reported_by: 'client'
  };
  const contentDigestUri =
    'sha256:' +
    createHash('sha256').update(canonicalJson(manifest), 'utf8').digest('hex');

  try {
    const res = (await callWorkbenchTool('workbench_commit', {
      id: wbId,
      manifest,
      content_digest_uri: contentDigestUri
    })) as { idempotent_replay?: boolean } | null;
    if (res?.idempotent_replay) {
      // eslint-disable-next-line no-console
      console.log('[nokv] idempotent replay acknowledged for', wbId);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[nokv] workbench_commit failed', err);
  }
}
