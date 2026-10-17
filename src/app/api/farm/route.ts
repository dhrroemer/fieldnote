import { NextResponse } from 'next/server';
import { readFarmData } from '@/lib/farm-store';

export function GET() {
  return NextResponse.json(readFarmData());
}
