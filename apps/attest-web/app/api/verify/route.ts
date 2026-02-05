/**
 * Vercel please don't ban me, this is for a hackathon submission.
 * I explicitly use this for two URLs only, it is not a generic tool.
 */
import { NextRequest, NextResponse } from 'next/server';
import { NEAR_AI_BASE_URL, NRAS_BASE_URL } from '@repo/packages-utils/near';

/** urls used to verify attestations */
const ALLOWED_URL_PREFIXES = [NEAR_AI_BASE_URL, NRAS_BASE_URL];

/** check if url is allowed */
export function isAllowedUrl(url: string): boolean {
  return ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

//** cors headers for cross-origin requests */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

async function requestFactory(
  request: NextRequest,
  method: 'GET' | 'POST'
): Promise<NextResponse> {
  try {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'missing required query parameter: url' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'invalid URL provided' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if URL is allowed
    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        { error: 'URL not in allowlist' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Append any extra query parameters that were incorrectly parsed as separate params
    // This happens when the inner URL's query string isn't properly URL-encoded
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      if (key !== 'url') {
        targetUrl.searchParams.set(key, value);
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };

    if (method === 'POST') {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(targetUrl.toString(), fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `upstream returned ${response.status}: ${errorText}` },
        { status: response.status, headers: corsHeaders }
      );
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('request failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'request failed',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return requestFactory(request, 'GET');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return requestFactory(request, 'POST');
}
