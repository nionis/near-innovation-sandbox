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

export async function verify(
  receipt: Receipt,
  blockchain: AttestationsBlockchain
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
            result = await verifyModelAndGatewayAttestation(receipt);
            const total = aggregateVerificationResults(Object.values(result));
            if (total.valid) return result;
            throw new Error(
              total.message ??
                'model and gateway attestation verification failed'
            );
          },
          { retries: 3, delay: 1000 }
        );
      } catch {}

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
