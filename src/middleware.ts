import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Dev bypass: set NEXT_PUBLIC_DISABLE_ALL_AUTH=true to disable protection
  if (process.env.NEXT_PUBLIC_DISABLE_ALL_AUTH === 'true') {
    return; // allow all requests in dev
  }

  if (isProtectedRoute(req)) await auth.protect();
});
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
