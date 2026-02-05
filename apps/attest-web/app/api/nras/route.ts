import { NextResponse } from 'next/server';

const NRAS_URL = 'https://nras.attestation.nvidia.com/v3/attest/gpu';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = await request.text();

    const response = await fetch(NRAS_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: payload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `NVIDIA NRAS returned ${response.status}: ${errorText}` },
        { status: response.status, headers: corsHeaders }
      );
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('NRAS proxy failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'NRAS proxy failed',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
