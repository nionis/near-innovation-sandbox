import type { NearBlockchainNetwork } from '@repo/packages-utils/near';
import { NextResponse } from 'next/server';
import type {
  Receipt,
  AllVerificationResults,
} from '@repo/packages-attestations';
import * as SMART_CONTRACTS from '@repo/contracts-attestations/deployment';
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain';
import { verify } from '@repo/packages-attestations';

const NETWORK_ID: NearBlockchainNetwork = 'testnet';
const CONTRACT_ID = SMART_CONTRACTS[NETWORK_ID].contractId;

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
): Promise<NextResponse<AllVerificationResults | { error: string }>> {
  try {
    // Parse request body
    const receipt = (await request.json()) as Receipt;

    // Validate required fields
    const requiredFields: (keyof Receipt)[] = [
      'version',
      'timestamp',
      'model',
      'prompt',
      'requestHash',
      'responseHash',
      'signature',
      'signingAddress',
      'signingAlgo',
      'output',
      'proofHash',
    ];

    for (const field of requiredFields) {
      if (receipt[field] === undefined || receipt[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Initialize blockchain client (read-only)
    const blockchain = new AttestationsBlockchain({
      networkId: NETWORK_ID,
      contractId: CONTRACT_ID,
    });

    // Verify the receipt
    const results = await verify(receipt, blockchain);

    return NextResponse.json(results, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Verification failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Verification failed',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
