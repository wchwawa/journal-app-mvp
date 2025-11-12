// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs';

const scrubEvent = (
  event: Sentry.ErrorEvent,
  _hint: Sentry.EventHint
): Sentry.ErrorEvent | null => {
  if (event.request?.headers) {
    delete event.request.headers.authorization;
    delete event.request.headers.Authorization;
  }
  return event ?? null;
};

if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
  const enableReplay = process.env.NODE_ENV !== 'production';
  const integrations = enableReplay ? [Sentry.replayIntegration()] : [];

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
    integrations,
    sendDefaultPii: process.env.NODE_ENV !== 'production',
    tracesSampleRate: 1,
    replaysSessionSampleRate: enableReplay ? 0.1 : 0,
    replaysOnErrorSampleRate: enableReplay ? 1.0 : 0,
    beforeSend: scrubEvent,
    debug: false
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
