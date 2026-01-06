import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// This API route is deprecated and no longer in use.
// It returns a 410 Gone status to any request to fix the build error
// caused by an empty route file, while effectively removing the endpoint's
// functionality as requested.

export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'This API endpoint is no longer available.' }, { status: 410 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'This API endpoint is no longer available.' }, { status: 410 });
}

export async function PUT(request: NextRequest) {
    return NextResponse.json({ error: 'This API endpoint is no longer available.' }, { status: 410 });
}

export async function DELETE(request: NextRequest) {
    return NextResponse.json({ error: 'This API endpoint is no longer available.' }, { status: 410 });
}

export async function PATCH(request: NextRequest) {
    return NextResponse.json({ error: 'This API endpoint is no longer available.' }, { status: 410 });
}
