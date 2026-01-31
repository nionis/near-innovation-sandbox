import { attestModel } from './attest.js';
import { verifyModelAttestation } from './verify.js';
import type { GenerateTextResult } from 'ai';
import type { Receipt } from './types.js';

export type * from './types.js';

export async function attest(
  result: GenerateTextResult<any, any>,
  nearAiApiKey: string
): Promise<Receipt> {
  return await attestModel(result, nearAiApiKey);
}

export async function verify(
  receipt: Receipt
): Promise<{ verified: boolean; errors: string[] }> {
  return await verifyModelAttestation(receipt);
}
