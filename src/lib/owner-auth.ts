import { createHmac, timingSafeEqual } from 'node:crypto';

export const OWNER_COOKIE = 'fieldnote_owner';
const SESSION_SECONDS = 60 * 60 * 24 * 14;

function sessionSecret() {
  return process.env.SESSION_SECRET;
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function isOwnerRequest(request: Request) {
  const secret = sessionSecret();
  if (!secret) return false;
  const cookie = request.headers
    .get('cookie')
    ?.split('; ')
    .find((item) => item.startsWith(`${OWNER_COOKIE}=`))
    ?.slice(OWNER_COOKIE.length + 1);
  if (!cookie) return false;

  const [expires, signature] = cookie.split('.');
  if (!expires || !signature || Number(expires) <= Date.now()) return false;
  return safeEqual(signature, sign(expires, secret));
}

export function createOwnerCookie() {
  const secret = sessionSecret();
  if (!secret) throw new Error('SESSION_SECRET is not configured.');
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${OWNER_COOKIE}=${expires}.${sign(expires, secret)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearOwnerCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${OWNER_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function verifyOwnerPassword(password: string) {
  const expected = process.env.OWNER_PASSWORD;
  if (!expected) return false;
  return safeEqual(password, expected);
}
