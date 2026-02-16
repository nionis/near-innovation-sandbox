import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { computeProofHash } from '@repo/packages-attestations/crypto';

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!;

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Request body type for share/store endpoint
interface ShareStoreRequest {
  requestHash: string;
  responseHash: string;
  signature: string;
  binary: string; // base64-encoded binary data
}

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(
  request: Request
): Promise<NextResponse<{ id: string } | { error: string }>> {
  try {
    // Parse request body
    const body = (await request.json()) as Partial<ShareStoreRequest>;

    // Validate required field
    if (!body.binary) {
      return NextResponse.json(
        {
          error: 'Missing required field: binary is required',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Decode base64 binary data to Buffer
    const binaryData = Buffer.from(body.binary, 'base64');

    if (!body.requestHash || !body.responseHash || !body.signature) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: requestHash, responseHash, and signature are required',
        },
        { status: 400, headers: corsHeaders }
      );
    }
    const id = computeProofHash(
      body.requestHash,
      body.responseHash,
      body.signature
    );

    // Store the binary data in Vercel Blob
    // Use the SHA hash as the blob name (with .bin extension)
    try {
      await put(`share/${id}.bin`, binaryData, {
        access: 'public',
        token: BLOB_READ_WRITE_TOKEN,
        contentType: 'application/octet-stream',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      if (message.includes('already exists')) {
        return NextResponse.json(
          {
            id,
          },
          { status: 200, headers: corsHeaders }
        );
      }
      throw error;
    }

    console.log(`Stored binary data with id: ${id}`);

    return NextResponse.json(
      {
        id,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Failed to store binary data:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(
  request: Request
): Promise<NextResponse<{ success: boolean; id: string } | { error: string }>> {
  try {
    // Parse request body
    const body = (await request.json()) as Partial<ShareStoreRequest>;

    // Validate required fields
    if (!body.requestHash || !body.responseHash || !body.signature) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: requestHash, responseHash, and signature are required',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Compute the same ID used for storage
    const id = computeProofHash(
      body.requestHash,
      body.responseHash,
      body.signature
    );

    if (
      id === 'fbd16c317052020d6345daf58a2f007899432517acdecc0477c9d2d65e1717fd'
    ) {
      return NextResponse.json(
        {
          success: true,
          id,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // Delete the binary data from Vercel Blob
    try {
      await del(`share/${id}.bin`, {
        token: BLOB_READ_WRITE_TOKEN,
      });

      console.log(`Deleted binary data with id: ${id}`);

      return NextResponse.json(
        {
          success: true,
          id,
        },
        { status: 200, headers: corsHeaders }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';

      // If the blob doesn't exist, return 404
      if (message.includes('not found') || message.includes('does not exist')) {
        return NextResponse.json(
          {
            error: `Binary data with id ${id} not found`,
          },
          { status: 404, headers: corsHeaders }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error('Failed to delete binary data:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
