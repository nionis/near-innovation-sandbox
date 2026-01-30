import type {
  NearAIChatModelId,
  SignatureResponse,
  ModelAttestationResponse,
} from '@repo/packages-near';
import type { GenerateTextResult, ModelMessage } from 'ai';
import type { Receipt } from './types.js';
import { sha256, compareHashes } from './crypto.js';

interface NearAiOps {
  baseURL: string;
  apiKey: string;
  headers?: Record<string, string>;
}

async function fetchSignature(
  chatId: string,
  model: NearAIChatModelId,
  ops: NearAiOps
): Promise<SignatureResponse> {
  const { baseURL, apiKey, headers } = ops;

  const url = `${baseURL}/signature/${chatId}?model=${encodeURIComponent(model)}&signing_algo=ecdsa`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch signature (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

async function fetchModelAttestation(
  model: NearAIChatModelId,
  ops: NearAiOps
): Promise<ModelAttestationResponse> {
  const { baseURL, apiKey, headers } = ops;
  const url = `${baseURL}/attestation/report?model=${encodeURIComponent(model)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch attestation (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

export async function attest(
  result: GenerateTextResult<any, any>,
  ops: NearAiOps
) {
  const chatId = result.response.id;
  const body = String(result.request.body);

  let model: NearAIChatModelId;
  let messages: ModelMessage[];
  let prompt: string;

  // parse the request body to get the model and messages
  try {
    const parsed = JSON.parse(body);
    model = parsed.model as NearAIChatModelId;
    messages = parsed.messages;
    prompt = (messages[messages.length - 1]?.content as string) || '';
  } catch (error) {
    console.error('Failed to parse request body:', error);
    throw error;
  }

  // compute hashes for the request and response
  const requestPayload = JSON.stringify(messages);
  const requestHash = sha256(requestPayload);
  const responseHash = sha256(result.text);

  // fetch the cryptographic signature using the provider's method
  const signatureData = await fetchSignature(chatId, model, ops);

  console.log({ signatureData, requestHash, responseHash, model, prompt });

  // verify the signature text matches our computed hashes
  if (!compareHashes(signatureData.text, requestHash, responseHash)) {
    throw new Error('signature mismatch');
  }

  // build the receipt
  const receipt: Receipt = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    model: model,
    prompt: prompt,
    contentFile: undefined,
    requestHash: requestHash,
    responseHash: responseHash,
    signature: signatureData.signature,
    signingAddress: signatureData.signing_address,
    signingAlgo: signatureData.signing_algo,
    output: result.text,
  };

  return receipt;
}

// export async function verify();
