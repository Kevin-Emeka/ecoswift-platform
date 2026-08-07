import { NextResponse } from 'next/server';
import type { ServiceHealth } from '@ecoswift/types';

export async function GET() {
  const body: ServiceHealth = {
    service: 'admin',
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
