import type {
  NearAIChatModelId,
  SignatureResponse,
  ModelAttestationResponse,
} from '@repo/packages-near';
import type { GenerateTextResult, ModelMessage } from 'ai';
import type { Receipt, VerificationResult } from './types.js';
import { sha256, compareHashes, verifySignature } from './crypto.js';

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
  const signatureData = await fetchSignature(chatId, model, ops);

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

export async function verify(ops: NearAiOps, receipt: Receipt) {
  const errors: string[] = [];

  // verify the ECDSA signature
  const signatureText = `${receipt.requestHash}:${receipt.responseHash}`;

  const signatureResult = verifySignature(
    signatureText,
    receipt.signature,
    receipt.signingAddress
  );

  if (!signatureResult.valid) {
    errors.push('signature verification failed');
  }

  const addressMatch =
    signatureResult.recoveredAddress.toLowerCase() ===
    receipt.signingAddress.toLowerCase();

  console.log(`  Signature valid: ${signatureResult.valid}`);
  console.log(`  Expected address: ${receipt.signingAddress}`);
  console.log(`  Recovered address: ${signatureResult.recoveredAddress}`);
  console.log(`  Address match: ${addressMatch}`);

  const result: VerificationResult = {
    valid: signatureResult.valid && addressMatch,
    checks: {
      signatureValid: signatureResult.valid,
      recoveredAddress: signatureResult.recoveredAddress,
      addressMatch,
    },
    errors,
  };

  return result;
}
