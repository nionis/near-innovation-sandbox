import type { AttestInput, AttestOutput } from './types.js';
import { type NearAIChatModelId } from '@repo/packages-utils/near';
import { sha256_utf8_str } from '@repo/packages-utils/crypto';
import { compareHashes } from './crypto.js';
import { fetchSignature } from './verify-utils.js';

/** get attestation from model for a chat */
export async function attestChat(
  input: AttestInput,
  nearAiApiKey: string,
  nearAiBaseURL: string
): Promise<AttestOutput> {
  const { chatId, requestBody, responseBody } = input;

  // parse the request body to get the model and messages
  let model: NearAIChatModelId;
  try {
    const parsed = JSON.parse(requestBody);
    model = parsed.model as NearAIChatModelId;
  } catch (error) {
    console.error('failed to parse request body:', error);
    throw error;
  }

  // compute hashes for the request and response
  const requestHash = sha256_utf8_str(requestBody);
  const responseHash = sha256_utf8_str(responseBody);

  // fetch the cryptographic signature using the provider's method
  const response = await fetchSignature(
    nearAiBaseURL,
    nearAiApiKey,
    model,
    chatId
  );

  // verify the signature text matches our computed hashes
  if (!compareHashes(response.text, requestHash, responseHash)) {
    throw new Error('signature mismatch');
  }

  return {
    requestHash,
    responseHash,
    signature: response.signature,
    signingAddress: response.signing_address,
    signingAlgo: response.signing_algo,
  };
}
