import { beforeAll, describe, expect, it } from 'vitest';

// Env must be complete before the module under test memoizes isNokvEnabled().
beforeAll(() => {
  Object.assign(process.env, {
    NOKV_ENABLED: 'true',
    NOKV_BIN: '/tmp/nokv-test-bin',
    NOKV_ROOT_ID: 'a'.repeat(32),
    NOKV_ETCD_ENDPOINT: 'http://127.0.0.1:2379',
    NOKV_ETCD_KEY_PREFIX: '/nokv/control',
    NOKV_OBJECT_ENDPOINT: 'http://127.0.0.1:9000',
    NOKV_OBJECT_BUCKET: 'echojournal-nokv',
    NOKV_OBJECT_ROOT: 'echojournal',
    NOKV_OBJECT_REGION: 'us-east-1',
    NOKV_OBJECT_ACCESS_KEY_ID: 'test',
    NOKV_OBJECT_SECRET_ACCESS_KEY: 'test',
    NOKV_WORKBENCH_ROOT: '/agents/echojournal/wb',
    NOKV_SESSION_SECRET: 'f'.repeat(64)
  });
});

async function loadModule() {
  return await import('@/lib/nokv/session-workspace');
}

describe('nokv session refs', () => {
  it('mints a verifiable ref bound to the user', async () => {
    const { mintSessionRef, verifySessionRef } = await loadModule();
    const ref = mintSessionRef('user_2abcDEF');
    expect(ref).toBeTruthy();
    const wbId = verifySessionRef('user_2abcDEF', ref!);
    expect(wbId).toMatch(/^vs-user_2abcDEF-[0-9a-f-]{36}$/);
  });

  it('rejects a ref presented by a different user', async () => {
    const { mintSessionRef, verifySessionRef } = await loadModule();
    const ref = mintSessionRef('user_alice');
    expect(verifySessionRef('user_mallory', ref!)).toBeNull();
  });

  it('rejects a tampered workbench id', async () => {
    const { mintSessionRef, verifySessionRef } = await loadModule();
    const ref = mintSessionRef('user_alice')!;
    const dot = ref.lastIndexOf('.');
    const forged = `vs-user_mallory-${ref.slice(3, dot).split('-').slice(-5).join('-')}.${ref.slice(dot + 1)}`;
    expect(verifySessionRef('user_mallory', forged)).toBeNull();
    expect(
      verifySessionRef('user_alice', `${ref.slice(0, dot)}.${'0'.repeat(32)}`)
    ).toBeNull();
  });

  it('rejects malformed refs', async () => {
    const { verifySessionRef } = await loadModule();
    expect(verifySessionRef('user_a', null)).toBeNull();
    expect(verifySessionRef('user_a', '')).toBeNull();
    expect(verifySessionRef('user_a', 'no-dot-here')).toBeNull();
    expect(verifySessionRef('user_a', 'bad/id.deadbeef')).toBeNull();
  });
});

describe('canonicalJson', () => {
  it('is key-order independent and deterministic', async () => {
    const { canonicalJson } = await loadModule();
    const a = canonicalJson({ b: 1, a: [{ y: 2, x: 1 }], c: null });
    const b = canonicalJson({ c: null, a: [{ x: 1, y: 2 }], b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":[{"x":1,"y":2}],"b":1,"c":null}');
  });

  it('drops undefined values and preserves array order', async () => {
    const { canonicalJson } = await loadModule();
    expect(canonicalJson({ a: undefined, b: [2, 1] })).toBe('{"b":[2,1]}');
  });
});
