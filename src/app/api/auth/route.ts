import { NextResponse } from 'next/server';
import {
  clearOwnerCookie,
  createOwnerCookie,
  isOwnerRequest,
  verifyOwnerPassword,
} from '@/lib/owner-auth';

export function GET(request: Request) {
  const configured = Boolean(
    process.env.OWNER_PASSWORD && process.env.SESSION_SECRET,
  );
  return NextResponse.json({
    authenticated: isOwnerRequest(request),
    configured,
    developmentAccess: process.env.NODE_ENV !== 'production' && !configured,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!process.env.OWNER_PASSWORD || !process.env.SESSION_SECRET) {
    return NextResponse.json(
      { error: 'Eigenaarstoegang is nog niet geconfigureerd.' },
      { status: 503 },
    );
  }
  if (!password || password.length > 512 || !verifyOwnerPassword(password)) {
    return NextResponse.json(
      { error: 'Onjuist wachtwoord.' },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ authenticated: true });
  response.headers.append('Set-Cookie', createOwnerCookie());
  return response;
}

export function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.headers.append('Set-Cookie', clearOwnerCookie());
  return response;
}
