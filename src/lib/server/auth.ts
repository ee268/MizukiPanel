import { timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'mizuki_panel_session';

export function validAccessToken(candidate: string | undefined, expected = process.env.PANEL_ACCESS_TOKEN): boolean {
  if (!candidate || !expected) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
