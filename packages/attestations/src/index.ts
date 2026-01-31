import type { Receipt, AllVerificationResults } from './types.js';
import type { GenerateTextResult } from 'ai';
import { attestChat } from './attest.js';
import {
  verifyChatAttestation,
  verifyModelAndGatewayAttestation,
} from './verify.js';

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
  return await Promise.all([
    verifyChatAttestation(receipt),
    verifyModelAndGatewayAttestation(receipt),
  ]).then(([chat, modelAndGateway]) => {
    const notOk = [chat, ...Object.values(modelAndGateway)].filter(
      (r) => !r.valid
    );
    return {
      chat,
      ...modelAndGateway,
      result: {
        valid: notOk.length === 0,
        message:
          notOk.length === 0
            ? undefined
            : notOk
                .filter((r) => r.message)
                .map((r) => r.message)
                .join(', '),
      },
    };
  });
}
