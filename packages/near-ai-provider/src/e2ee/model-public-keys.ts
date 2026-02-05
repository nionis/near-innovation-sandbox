import type { NearAIChatModelId } from '@repo/packages-utils/near';
import type {
  ModelPublicKeyRecord as Record,
  AttestationReport,
} from './types.js';
import { randomNonce } from '@repo/packages-utils/crypto';

export class ModelPublicKeys {
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private cache: Map<string, Record> = new Map();

  constructor(private nearAiBaseURL: string) {
    this.nearAiBaseURL = nearAiBaseURL;
  }

  private async fetchPublicKey(model: NearAIChatModelId): Promise<Record> {
    const nonce = randomNonce();
    const url = new URL(`${this.nearAiBaseURL}/attestation/report`);
    url.searchParams.set('model', model);
    url.searchParams.set('signing_algo', 'ecdsa');
    url.searchParams.set('nonce', nonce);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch model attestation (${response.status}): ${errorText}`
      );
    }

    const attestation: AttestationReport = await response.json();
    // get the first model attestation (they should all have the same public key for the same model)
    const modelAttestation = attestation.model_attestations[0];

    if (!modelAttestation) {
      throw new Error(`No model attestation found for model: ${model}`);
    }

    if (!modelAttestation.signing_public_key) {
      throw new Error(
        `Model attestation missing signing_public_key for model: ${model}`
      );
    }

    return {
      signingPublicKey: modelAttestation.signing_public_key,
      signingAddress: modelAttestation.signing_address,
      updatedAt: Date.now(),
    };
  }

  /** get or fetch a model's public key record */
  public async get(model: NearAIChatModelId): Promise<Record> {
    const cached = this.cache.get(model);

    if (cached && Date.now() - cached.updatedAt < this.cacheTTL) {
      return cached;
    }

    const record = await this.fetchPublicKey(model);
    this.cache.set(model, record);
    return record;
  }
}
