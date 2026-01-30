import type { NearAIProviderSettings } from './types.js';
import type {
  NearAIChatModelId,
  SignatureResponse,
  ModelAttestationResponse,
} from '@repo/packages-near';
import type { GenerateTextResult, ContentPart } from 'ai';
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain';
import { compareHashes, sha256 } from '@repo/packages-attestations/crypto';

export class NearAIAttestations {
  private readonly nearAiProviderSettings: NearAIProviderSettings;
  private readonly model: NearAIChatModelId;
  private readonly blockchain: AttestationsBlockchain;

  constructor(
    nearAiProviderSettings: NearAIProviderSettings,
    model: NearAIChatModelId,
    blockchain: AttestationsBlockchain
  ) {
    this.nearAiProviderSettings = nearAiProviderSettings;
    this.model = model;
    this.blockchain = blockchain;
  }

  private async fetchSignature(
    chatId: string,
    model: NearAIChatModelId
  ): Promise<SignatureResponse> {
    const { baseURL, apiKey, headers } = this.nearAiProviderSettings;

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

  private async fetchModelAttestation(
    model: NearAIChatModelId
  ): Promise<ModelAttestationResponse> {
    const { baseURL, apiKey, headers } = this.nearAiProviderSettings;
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

  public async attest(
    result: GenerateTextResult<any, any>
  ): Promise<AttestationRecord> {
    // Extract chatId from response - the ai SDK provides response metadata
    // The response.id is typically the chat completion ID
    const chatId = result.response.id;
    if (!chatId) {
      throw new Error('Failed to get chat ID from response');
    }

    // Compute hashes for the request and response
    const requestPayload = JSON.stringify(messages);
    const requestHash = sha256(requestPayload);
    const responseHash = sha256(result.text);

    console.log(`Response received (chat ID: ${chatId})`);
    console.log('Fetching TEE signature...');

    // Fetch the cryptographic signature using the provider's method
    const signatureData = await this.fetchSignature(chatId, this.model);

    // Verify the signature text matches our computed hashes (optional warning)
    if (!compareHashes(signatureData.text, requestHash, responseHash)) {
      // The API's hashes might be computed differently, so we use theirs
      console.warn(
        'Note: Local hashes differ from API hashes - using API-provided values'
      );
    }

    // Parse the signature text to get the actual hashes from the API
    const [apiRequestHash, apiResponseHash] = signatureData.text.split(':');

    // Build the receipt
    const receipt: Receipt = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      model: this.model,
      prompt: options.prompt,
      contentFile: options.contentFile,
      requestHash: apiRequestHash || requestHash,
      responseHash: apiResponseHash || responseHash,
      signature: signatureData.signature,
      signingAddress: signatureData.signing_address,
      signingAlgo: signatureData.signing_algo,
      output: result.text,
    };
  }
}
