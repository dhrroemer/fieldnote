import { NextResponse } from 'next/server';
import { isOwnerRequest } from '@/lib/owner-auth';

export function requireOwner(request: Request) {
  if (
    process.env.NODE_ENV !== 'production' &&
    (!process.env.OWNER_PASSWORD || !process.env.SESSION_SECRET)
  ) {
    return null;
  }
  if (isOwnerRequest(request)) return null;
  return NextResponse.json(
    { error: 'Log in als eigenaar om wijzigingen aan te brengen.' },
    { status: 401 },
  );
}
