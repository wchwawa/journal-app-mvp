import * as Sentry from '@sentry/nextjs';

const scrubEvent = (event: Sentry.Event) => {
  if (event.request?.headers) {
    delete event.request.headers.authorization;
    delete event.request.headers.Authorization;
  }
  if (process.env.NODE_ENV === 'production' && event.request) {
    event.request.cookies = undefined;
    event.request.data = undefined;
  }
  return event;
};

const sentryOptions: Sentry.NodeOptions | Sentry.EdgeOptions = {
  // Sentry DSN
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enable Spotlight in development
  spotlight: process.env.NODE_ENV === 'development',

  // Adds request headers and IP for users, for more info visit
  sendDefaultPii: process.env.NODE_ENV !== 'production',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Scrub potentially sensitive request data before sending to Sentry
  beforeSend: scrubEvent,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false
};

export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      // Node.js Sentry configuration
      Sentry.init(sentryOptions);
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      // Edge Sentry configuration
      Sentry.init(sentryOptions);
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
