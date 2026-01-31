import type { Receipt, AllVerificationResults } from './types.js';
import type { GenerateTextResult } from 'ai';
import { retry } from '@repo/packages-utils';
import { attestChat } from './attest.js';
import {
  verifyChatAttestation,
  verifyModelAndGatewayAttestation,
} from './verify.js';
import { aggregateVerificationResults } from './verify-utils.js';

export type * from './types.js';

export async function attest(
  result: GenerateTextResult<any, any>,
  nearAiApiKey: string
): Promise<Receipt> {
  return await attestChat(result, nearAiApiKey);
}

export async function verify(
  receipt: Receipt
): Promise<AllVerificationResults> {
  const [chat, modelAndGateway] = await Promise.all([
    verifyChatAttestation(receipt),
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
  ]);

  const result = aggregateVerificationResults([
    chat,
    ...Object.values(modelAndGateway),
  ]);

  return {
    chat,
    ...modelAndGateway,
    result,
  };
}
