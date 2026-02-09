import { NextRequest, NextResponse } from 'next/server';
import { head } from '@vercel/blob';
import type { ChatExport } from '@repo/packages-attestations/types';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!;

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proofHash: string }> }
): Promise<NextResponse<ChatExport | { error: string }>> {
  try {
    const { proofHash } = await params;

    // Validate proofHash parameter
    if (!proofHash) {
      return NextResponse.json(
        { error: 'proofHash parameter is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Construct the blob URL
    const blobUrl = `share/${proofHash}.json`;

    try {
      // Check if the blob exists
      const blobMetadata = await head(blobUrl, {
        token: BLOB_READ_WRITE_TOKEN,
      });

      // Fetch the blob content
      const response = await fetch(blobMetadata.url);

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to retrieve chat export from storage' },
          { status: response.status, headers: corsHeaders }
        );
      }

      const chatExport = (await response.json()) as ChatExport;

      return NextResponse.json(chatExport, {
        status: 200,
        headers: corsHeaders,
      });
    } catch (blobError) {
      // If blob doesn't exist, return 404
      if (
        blobError instanceof Error &&
        blobError.message.includes('not found')
      ) {
        return NextResponse.json(
          { error: 'Chat export not found' },
          { status: 404, headers: corsHeaders }
        );
      }
      throw blobError;
    }
  } catch (error) {
    console.error('Failed to retrieve chat export:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
