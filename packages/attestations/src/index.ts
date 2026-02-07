import type {
  AttestInput,
  AttestOutput,
  VerifyInput,
  VerifyOutput,
} from './types.js';
import { retry } from '@repo/packages-utils';
import { sha256_utf8_str } from '@repo/packages-utils/crypto';
import { NEAR_AI_BASE_URL, NRAS_BASE_URL } from '@repo/packages-utils/near';
import { attestChat } from './attest.js';
import {
  verifyChatAttestation,
  verifyModelAndGatewayAttestation,
} from './verify.js';
import { aggregateVerificationResults } from './verify-utils.js';
import { AttestationsBlockchain } from './blockchain.js';
import { computeProofHash } from './crypto.js';

export type * from './types.js';

export async function attest(
  input: AttestInput,
  nearAiApiKey: string,
  options?: {
    nearAiBaseURL?: string;
  }
): Promise<AttestOutput> {
  const output = await attestChat(
    input,
    nearAiApiKey,
    options?.nearAiBaseURL ?? NEAR_AI_BASE_URL
  );
  return output;
}

export async function storeAttestationRecordWithBlockchain(
  blockchain: AttestationsBlockchain,
  record: { proofHash: string; timestamp: number }
): Promise<{ txHash: string }> {
  return blockchain.storeAttestationRecord(record.proofHash, record.timestamp);
}

export async function storeAttestationRecordWithAPI(
  apiUrl: string,
  record: { proofHash: string; timestamp: number }
): Promise<{ txHash: string }> {
  const response = await fetch(`${apiUrl}/api/store`, {
    method: 'POST',
    body: JSON.stringify({
      proofHash: record.proofHash,
      timestamp: record.timestamp,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to store attestation record');
  }
  return response.json();
}

export async function verify(
  input: VerifyInput,
  blockchain: AttestationsBlockchain,
  options?: {
    nearAiBaseURL?: string;
    nrasUrl?: string;
  }
): Promise<VerifyOutput> {
  // compute hashes for the request and response
  const requestHash = sha256_utf8_str(input.requestBody);
  const responseHash = sha256_utf8_str(input.responseBody);
  const proofHash = computeProofHash(
    requestHash,
    responseHash,
    input.signature
  );

  const [chat, modelAndGateway, notorized] = await Promise.all([
    // verify the chat attestation
    verifyChatAttestation({
      requestHash,
      responseHash,
      signature: input.signature,
      signingAddress: input.signingAddress,
    }),
    // verify the model and gateway attestation
    (async () => {
      let result: Awaited<ReturnType<typeof verifyModelAndGatewayAttestation>>;

      try {
        await retry(
          async (count, max) => {
            console.log(
              `Verify model and gateway attestation (attempt ${count + 1} of ${max})...`
            );
            result = await verifyModelAndGatewayAttestation(
              {
                model: input.model,
                signingAddress: input.signingAddress,
                requestHash,
                responseHash,
              },
              options?.nearAiBaseURL ?? NEAR_AI_BASE_URL,
              options?.nrasUrl ?? NRAS_BASE_URL
            );
            const total = aggregateVerificationResults(Object.values(result));
            if (total.valid) return result;
            throw new Error(
              total.message ??
                'model and gateway attestation verification failed'
            );
          },
          { retries: 3, delay: 1000 }
        );
      } catch (error) {
        console.error('error verifying model and gateway attestation:', error);
      }

      return result!;
    })(),
    // verify the blockchain attestation
    (async () => {
      const attestationRecord =
        await blockchain.getAttestationRecord(proofHash);

      if (!attestationRecord) {
        return { valid: false, message: 'proof hash not found' };
      }

      if (attestationRecord.timestamp !== new Date(input.timestamp).getTime()) {
        return { valid: false, message: 'timestamp does not match' };
      }

      return { valid: true };
    })(),
  ]);

  const result = aggregateVerificationResults([
    chat,
    notorized,
    ...Object.values(modelAndGateway),
  ]);

  return {
    chat,
    notorized,
    ...modelAndGateway,
    result,
  };
}
