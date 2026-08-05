import 'server-only';

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connArgv } from './mcp-client';

// Audio blobs bypass the resident MCP stdio channel entirely (design §6):
// 16MiB read ceiling + 300-byte read pages + 5s timeouts + head-of-line
// blocking make it unusable for 25MB media. The CLI's collect/materialize
// read/write local files in-process instead.

const BLOB_TIMEOUT_MS = 60_000;
// collect refuses payloads above --max-artifact-bytes; 26 MiB leaves headroom
// over the app-level 25MB upload cap.
const MAX_ARTIFACT_BYTES = 27_262_976;
const MAX_CONCURRENT = 2;

let active = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}

function release(): void {
  active--;
  const next = waiters.shift();
  if (next) next();
}

function runCli(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      process.env.NOKV_BIN!,
      args,
      { timeout: BLOB_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(
            new Error(
              `nokv cli failed: ${err.message} ${String(stderr).slice(0, 300)}`
            )
          );
        } else {
          resolve();
        }
      }
    );
  });
}

/** Uploads a blob as a create-only artifact. AlreadyExists surfaces as an
 *  error from the CLI; callers treat it as idempotent success where sound. */
export async function collectBlob(
  wbId: string,
  section: string,
  path: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  await acquire();
  const dir = await mkdtemp(join(tmpdir(), 'nokv-blob-'));
  const file = join(dir, 'payload.bin');
  try {
    await writeFile(file, data);
    await runCli([
      ...connArgv(),
      '--max-artifact-bytes',
      String(MAX_ARTIFACT_BYTES),
      'collect',
      wbId,
      section,
      file,
      path,
      '--content-type',
      contentType
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
    release();
  }
}

/** Downloads a blob to memory via materialize. Returns null when the CLI
 *  reports a missing path. */
export async function materializeBlob(
  wbId: string,
  section: string,
  path: string
): Promise<Buffer | null> {
  await acquire();
  const dir = await mkdtemp(join(tmpdir(), 'nokv-blob-'));
  const file = join(dir, 'payload.bin');
  try {
    await runCli([...connArgv(), 'materialize', wbId, section, path, file]);
    return await readFile(file);
  } catch (err) {
    if (/not.?found/i.test(String(err))) return null;
    throw err;
  } finally {
    await rm(dir, { recursive: true, force: true });
    release();
  }
}
