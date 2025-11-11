import { describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { isTrustedOrigin } from '@/lib/security';

const buildRequest = (
  host: string,
  options: { origin?: string | null; referer?: string | null } = {}
) => {
  const headers = new Headers();
  headers.set('host', host);
  if (options.origin !== undefined) headers.set('origin', options.origin ?? '');
  if (options.referer !== undefined)
    headers.set('referer', options.referer ?? '');

  return {
    headers,
    nextUrl: new URL(`https://${host}/api/test`)
  } as unknown as NextRequest;
};

describe('isTrustedOrigin', () => {
  it('accepts matching origin host', () => {
    const request = buildRequest('app.echojournal.dev', {
      origin: 'https://app.echojournal.dev'
    });
    expect(isTrustedOrigin(request)).toBe(true);
  });

  it('rejects mismatched origin', () => {
    const request = buildRequest('app.echojournal.dev', {
      origin: 'https://evil.site'
    });
    expect(isTrustedOrigin(request)).toBe(false);
  });

  it('falls back to referer when origin missing', () => {
    const request = buildRequest('app.echojournal.dev', {
      referer: 'https://app.echojournal.dev/dashboard'
    });
    expect(isTrustedOrigin(request)).toBe(true);
  });

  it('treats missing origin/referer as trusted (SSR/server calls)', () => {
    const request = buildRequest('app.echojournal.dev');
    expect(isTrustedOrigin(request)).toBe(true);
  });
});
