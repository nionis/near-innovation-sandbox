import type { NearAIChatModelId } from '@repo/packages-utils/near';
import { randomNonce } from '@repo/packages-utils/crypto';

/** cache for model public keys */
export class ModelPublicKeysCache {
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private cache: Map<string, ModelPublicKeyRecord> = new Map();

  constructor(private nearAiBaseURL: string) {
    this.nearAiBaseURL = nearAiBaseURL;
  }

  private async fetchPublicKey(
    model: NearAIChatModelId
  ): Promise<ModelPublicKeyRecord> {
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

    if (modelAttestation.request_nonce !== nonce) {
      throw new Error(`Request nonce mismatch for model: ${model}`);
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
  public async get(model: NearAIChatModelId): Promise<ModelPublicKeyRecord> {
    const cached = this.cache.get(model);

    if (cached && Date.now() - cached.updatedAt < this.cacheTTL) {
      return cached;
    }

    const record = await this.fetchPublicKey(model);
    this.cache.set(model, record);
    return record;
  }
}

/** a record of a model's public key */
export interface ModelPublicKeyRecord {
  signingPublicKey: string;
  signingAddress: string;
  updatedAt: number;
}

/** a report of a model's attestation */
export interface AttestationReport {
  gateway_attestation: {
    signing_address: string;
    signing_algo: string;
  };
  model_attestations: Array<{
    signing_address: string;
    signing_algo: string;
    signing_public_key: string;
    request_nonce: string;
  }>;
}
