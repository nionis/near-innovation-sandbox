import type { Chat, Receipt, AllVerificationResults } from './types.js';
import { retry } from '@repo/packages-utils';
import { attestChat } from './attest.js';
import {
  verifyChatAttestation,
  verifyModelAndGatewayAttestation,
} from './verify.js';
import { aggregateVerificationResults } from './verify-utils.js';
import { AttestationsBlockchain } from './blockchain.js';

export type * from './types.js';

export async function attest(
  chat: Chat,
  nearAiApiKey: string
): Promise<Receipt> {
  const receipt = await attestChat(chat, nearAiApiKey);
  return receipt;
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

const DEFAULT_NRAS_URL = 'https://nras.attestation.nvidia.com/v3/attest/gpu';

export async function verify(
  receipt: Receipt,
  blockchain: AttestationsBlockchain,
  options?: {
    nrasUrl?: string;
  }
): Promise<AllVerificationResults> {
  const [chat, modelAndGateway, notorized] = await Promise.all([
    // verify the chat attestation
    verifyChatAttestation(receipt),
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
              receipt,
              options?.nrasUrl ?? DEFAULT_NRAS_URL
            );
            console.log('result', result);
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
      const attestationRecord = await blockchain.getAttestationRecord(
        receipt.proofHash
      );

      if (!attestationRecord) {
        return { valid: false, message: 'proof hash not found' };
      }

      if (
        attestationRecord.timestamp !== new Date(receipt.timestamp).getTime()
      ) {
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
