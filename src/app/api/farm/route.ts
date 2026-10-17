import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { readFarmData } from '@/lib/farm-store';

export async function GET() {
  await headers();
  return NextResponse.json(await readFarmData(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
