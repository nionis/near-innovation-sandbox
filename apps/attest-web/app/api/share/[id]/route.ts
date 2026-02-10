import { NextRequest, NextResponse } from 'next/server';
import { head } from '@vercel/blob';

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate id parameter
    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Construct the blob URL for binary data
    const blobUrl = `share/${id}.bin`;

    try {
      // Check if the blob exists
      const blobMetadata = await head(blobUrl, {
        token: BLOB_READ_WRITE_TOKEN,
      });

      // Fetch the binary blob content
      const response = await fetch(blobMetadata.url);

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to retrieve binary data from storage' },
          { status: response.status, headers: corsHeaders }
        );
      }

      // Get the binary data as ArrayBuffer
      const binaryData = await response.arrayBuffer();

      // Return the binary data with appropriate content type
      return new NextResponse(binaryData, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/octet-stream',
          'Content-Length': binaryData.byteLength.toString(),
        },
      });
    } catch (blobError) {
      // If blob doesn't exist, return 404
      if (
        blobError instanceof Error &&
        blobError.message.includes('not found')
      ) {
        return NextResponse.json(
          { error: 'Binary data not found' },
          { status: 404, headers: corsHeaders }
        );
      }
      throw blobError;
    }
  } catch (error) {
    console.error('Failed to retrieve binary data:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
