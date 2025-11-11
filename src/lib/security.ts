import type { NextRequest } from 'next/server';

const getHost = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.host.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Returns true when the incoming request originated from the same host.
 * Missing Origin/Referer headers are treated as trusted to preserve SSR
 * requests and server-to-server calls.
 */
export const isTrustedOrigin = (request: NextRequest) => {
  const expectedHost =
    request.headers.get('host')?.toLowerCase() || request.nextUrl.host;
  if (!expectedHost) return false;

  const originHost = getHost(request.headers.get('origin'));
  if (originHost) {
    return originHost === expectedHost;
  }

  const refererHost = getHost(request.headers.get('referer'));
  if (refererHost) {
    return refererHost === expectedHost;
  }

  return true;
};
