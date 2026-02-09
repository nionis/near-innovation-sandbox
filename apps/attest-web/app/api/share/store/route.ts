import type { ChatExport } from '@repo/packages-attestations/types';
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { computeProofHash } from '@repo/packages-attestations/crypto';
import { sha256_utf8_str } from '@repo/packages-utils/crypto';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!;

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

export async function POST(
  request: Request
): Promise<NextResponse<{ proofHash: string } | { error: string }>> {
  try {
    // Parse request body
    const body = (await request.json()) as Partial<ChatExport>;

    // Validate required fields for computing proofHash
    if (!body.requestBody || !body.responseBody || !body.signature) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: requestBody, responseBody, and signature are required',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Compute proofHash from the request/response hashes and signature
    // First, we need to hash the request and response bodies
    const requestHash = sha256_utf8_str(body.requestBody);
    const responseHash = sha256_utf8_str(body.responseBody);
    const proofHash = computeProofHash(
      requestHash,
      responseHash,
      body.signature
    );

    // Validate that the proofHash from the body matches the computed one (if provided)
    if (body.proofHash && body.proofHash !== proofHash) {
      return NextResponse.json(
        {
          error: 'Provided proofHash does not match computed hash',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Store the full ChatExport object in Vercel Blob
    // Use proofHash as the blob name (with .json extension)
    const chatExport: ChatExport = {
      ...body,
      proofHash, // Ensure the computed proofHash is included
    } as ChatExport;

    const blob = await put(
      `share/${proofHash}.json`,
      JSON.stringify(chatExport),
      {
        access: 'public',
        token: BLOB_READ_WRITE_TOKEN,
        contentType: 'application/json',
      }
    );

    console.log(
      `Stored ChatExport with proofHash: ${proofHash} at ${blob.url}`
    );

    return NextResponse.json(
      {
        proofHash,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Failed to store chat export:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
