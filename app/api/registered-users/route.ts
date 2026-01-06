import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    { error: 'Endpoint removed. Data fetching is now handled by Server Components.' }, 
    { status: 410 }
  );
}
