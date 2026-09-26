import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, validAccessToken } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const hostname = event.url.hostname;
  if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '[::1]') {
    return new Response('MizukiPanel only accepts loopback requests', { status: 403 });
  }
  if (!process.env.PANEL_ACCESS_TOKEN) {
    return new Response('Start MizukiPanel with pnpm dev or pnpm start', { status: 503 });
  }

  event.locals.authenticated = validAccessToken(event.cookies.get(SESSION_COOKIE));
  const isPublic = event.url.pathname === '/login' || event.url.pathname.startsWith('/_app/') || event.url.pathname === '/favicon.svg';
  if (!isPublic && !event.locals.authenticated) {
    redirect(303, '/login');
  }
  if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
    if (event.request.headers.get('origin') !== event.url.origin) {
      return new Response('Invalid request origin', { status: 403 });
    }
  }
  return resolve(event);
};
