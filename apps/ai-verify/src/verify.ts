import fs from 'fs';

import {
  verifySignature,
  computeProofHash,
} from '@repo/packages-attestations/crypto';
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain';
import type {
  Receipt,
  VerificationResult,
  VerifyOptions,
  BlockchainConfig,
} from './types.js';

// Re-export types for convenience
export type { VerificationResult, VerifyOptions } from './types.js';

/**
 * Verify a receipt's authenticity
 */
export async function verify(
  options: VerifyOptions
): Promise<VerificationResult> {
  const errors: string[] = [];

  // Load the receipt
  if (!fs.existsSync(options.receiptFile)) {
    throw new Error(`Receipt file not found: ${options.receiptFile}`);
  }

  const receiptData = fs.readFileSync(options.receiptFile, 'utf-8');
  const receipt: Receipt = JSON.parse(receiptData);

  console.log('Verifying receipt...');
  console.log(`  Model: ${receipt.model}`);
  console.log(`  Timestamp: ${receipt.timestamp}`);

  // Verify the ECDSA signature
  const signatureText = `${receipt.requestHash}:${receipt.responseHash}`;
  console.log('\nVerifying TEE signature...');

  const signatureResult = verifySignature(
    signatureText,
    receipt.signature,
    receipt.signingAddress
  );

  if (!signatureResult.valid) {
    errors.push('Signature verification failed');
  }

  const addressMatch =
    signatureResult.recoveredAddress.toLowerCase() ===
    receipt.signingAddress.toLowerCase();

  console.log(`  Signature valid: ${signatureResult.valid}`);
  console.log(`  Expected address: ${receipt.signingAddress}`);
  console.log(`  Recovered address: ${signatureResult.recoveredAddress}`);
  console.log(`  Address match: ${addressMatch}`);

  const result: VerificationResult = {
    valid: signatureResult.valid && addressMatch,
    checks: {
      signatureValid: signatureResult.valid,
      recoveredAddress: signatureResult.recoveredAddress,
      addressMatch,
    },
    errors,
  };

  // Verify on-chain record if present and not skipped
  if (receipt.onChain && !options.skipOnChain) {
    console.log('\nVerifying on-chain record...');

    const accountId = process.env.NEAR_ACCOUNT_ID;
    const privateKey = process.env.NEAR_PRIVATE_KEY;
    const network = receipt.onChain.network;

    if (accountId && privateKey) {
      const blockchainConfig: BlockchainConfig = {
        networkId: network,
        accountId,
        privateKey,
        contractId: receipt.onChain.contractId,
      };

      const blockchain = new AttestationsBlockchain(blockchainConfig);
      await blockchain.init();

      // Compute expected proof hash
      const expectedProofHash = computeProofHash(
        receipt.requestHash,
        receipt.responseHash,
        receipt.signature
      );

      // Check if the proof hash matches
      if (expectedProofHash !== receipt.onChain.proofHash) {
        errors.push('Proof hash mismatch');
        result.valid = false;
      }

      // Fetch the on-chain record
      const attestation = await blockchain.getAttestation(
        receipt.onChain.proofHash
      );

      if (attestation) {
        result.checks.onChainExists = true;
        result.checks.onChainTimestamp = attestation.timestamp;
        result.checks.onChainStoredBy = attestation.stored_by;
        console.log(`  On-chain record found: Yes`);
        console.log(
          `  Stored at: ${new Date(attestation.timestamp).toISOString()}`
        );
        console.log(`  Stored by: ${attestation.stored_by}`);
      } else {
        result.checks.onChainExists = false;
        errors.push('On-chain record not found');
        result.valid = false;
        console.log(`  On-chain record found: No`);
      }
    } else {
      console.log(
        '  Skipping on-chain verification (NEAR credentials not set)'
      );
    }
  } else if (receipt.onChain) {
    console.log('\nOn-chain verification skipped');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (result.valid) {
    console.log('VERIFICATION RESULT: VALID');
  } else {
    console.log('VERIFICATION RESULT: INVALID');
    if (errors.length > 0) {
      console.log('Errors:');
      errors.forEach((e) => console.log(`  - ${e}`));
    }
  }
  console.log('='.repeat(50));

  result.errors = errors;
  return result;
}
