import type { Receipt, Chat } from './types.js';
import type { ModelMessage } from 'ai';
import { type NearAIChatModelId } from '@repo/packages-utils/near';
import { sha256_utf8_str } from '@repo/packages-utils/crypto';
import { compareHashes, computeProofHash } from './crypto.js';
import { fetchSignature } from './verify-utils.js';

/** attest model output */
export async function attestChat(
  chat: Chat,
  nearAiApiKey: string,
  nearAiBaseURL: string
): Promise<Receipt> {
  const { id, requestBody, responseBody, output } = chat;

  let model: NearAIChatModelId;
  let messages: ModelMessage[];
  let prompt: string;

  // parse the request body to get the model and messages
  try {
    const parsed = JSON.parse(requestBody);
    model = parsed.model as NearAIChatModelId;
    messages = parsed.messages;
    prompt = (messages[messages.length - 1]?.content as string) || '';
  } catch (error) {
    console.error('failed to parse request body:', error);
    throw error;
  }

  // compute hashes for the request and response
  const requestHash = sha256_utf8_str(requestBody);
  const responseHash = sha256_utf8_str(responseBody);

  // fetch the cryptographic signature using the provider's method
  const signatureData = await fetchSignature(
    nearAiBaseURL,
    nearAiApiKey,
    model,
    id
  );

  console.log({
    requestHash,
    responseHash,
    signatureData: signatureData.text,
  });

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
    output: output,
    proofHash: computeProofHash(
      requestHash,
      responseHash,
      signatureData.signature
    ),
    txHash: undefined,
  };

  return receipt;
}
