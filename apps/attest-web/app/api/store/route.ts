import type { NearBlockchainNetwork } from '@repo/packages-utils/near';
import { NextResponse } from 'next/server';
import * as SMART_CONTRACTS from '@repo/contracts-attestations/deployment';
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain';

const NETWORK_ID: NearBlockchainNetwork = 'testnet';
const CONTRACT_ID = SMART_CONTRACTS[NETWORK_ID].contractId;

const ACCOUNT_ID = process.env.NEAR_ACCOUNT_ID!;
const PRIV_KEY = process.env.NEAR_PRIVATE_KEY!;

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
): Promise<NextResponse<{ txHash: string } | { error: string }>> {
  try {
    // Parse request body
    const body = (await request.json()) as {
      proofHash?: string;
      timestamp?: number;
    };

    if (!body?.proofHash || !body?.timestamp) {
      return NextResponse.json(
        { error: 'proofHash and timestamp are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize blockchain client
    const blockchain = new AttestationsBlockchain({
      networkId: NETWORK_ID,
      contractId: CONTRACT_ID,
      accountId: ACCOUNT_ID,
      privateKey: PRIV_KEY,
    });

    // Store attestation on-chain
    const result = await blockchain.storeAttestationRecord(
      body.proofHash,
      body.timestamp
    );

    return NextResponse.json(
      {
        txHash: result.txHash,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Failed to store attestation:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
