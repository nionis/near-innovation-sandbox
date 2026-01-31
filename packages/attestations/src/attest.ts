import type { Receipt } from './types.js';
import type { GenerateTextResult, ModelMessage } from 'ai';
import { type NearAIChatModelId } from '@repo/packages-near';
import { sha256, compareHashes, computeProofHash } from './crypto.js';
import { fetchSignature } from './verify-utils.js';

/** attest model output */
export async function attestChat(
  result: GenerateTextResult<any, any>,
  nearAiApiKey: string
): Promise<Receipt> {
  const chatId = result.response.id;
  const input = String(result.request.body);
  const output = JSON.stringify(result.response.body);

  let model: NearAIChatModelId;
  let messages: ModelMessage[];
  let prompt: string;

  // parse the request body to get the model and messages
  try {
    const parsed = JSON.parse(input);
    model = parsed.model as NearAIChatModelId;
    messages = parsed.messages;
    prompt = (messages[messages.length - 1]?.content as string) || '';
  } catch (error) {
    console.error('failed to parse request body:', error);
    throw error;
  }

  // compute hashes for the request and response
  const requestHash = sha256(input);
  const responseHash = sha256(output);

  // fetch the cryptographic signature using the provider's method
  const signatureData = await fetchSignature(chatId, model, nearAiApiKey);

  // verify the signature text matches our computed hashes
  if (!compareHashes(signatureData.text, requestHash, responseHash)) {
    throw new Error('signature mismatch');
  }

  // build the receipt
  const receipt: Receipt = {
    version: '1.0',
    timestamp: new Date().getTime(),
    model: model,
    prompt: prompt,
    content: undefined,
    requestHash: requestHash,
    responseHash: responseHash,
    signature: signatureData.signature,
    signingAddress: signatureData.signing_address,
    signingAlgo: signatureData.signing_algo,
    output: result.text,
    proofHash: computeProofHash(
      requestHash,
      responseHash,
      signatureData.signature
    ),
    txHash: '',
  };

  return receipt;
}
