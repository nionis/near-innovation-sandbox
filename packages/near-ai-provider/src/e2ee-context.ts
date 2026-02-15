import type { NearAIChatModelId } from '@repo/packages-utils/near';
import {
  type KeyPair,
  type ParsedRequestBody,
  toPrefixedPublicKey,
  encryptRequestBody,
} from '@repo/packages-utils/e2ee';
import { hexToBytes } from '@noble/curves/utils.js';
import { ModelPublicKeysCache } from './model-pks-cache.js';

export class E2EE {
  private cache: ModelPublicKeysCache;

  constructor(baseURL: string, options?: { fetch?: typeof fetch }) {
    this.cache = new ModelPublicKeysCache(baseURL, options);
  }

  public async createContext(model: NearAIChatModelId): Promise<E2EEContext> {
    // get the model's public key and add 0x04 prefix
    const modelsPublicKey = await this.cache.get(model).then((o) => {
      return toPrefixedPublicKey(hexToBytes(o.signingPublicKey));
    });

    return {
      modelsPublicKey,
      encryptRequestBody: (
        ephemeralKeyPairs: KeyPair[],
        requestBody: ParsedRequestBody
      ): ParsedRequestBody => {
        return encryptRequestBody(
          modelsPublicKey,
          ephemeralKeyPairs,
          requestBody
        );
      },
    };
  }
}

/** E2EE context for a model */
export interface E2EEContext {
  modelsPublicKey: Uint8Array;
  encryptRequestBody: (
    ephemeralKeyPairs: KeyPair[],
    requestBody: ParsedRequestBody
  ) => ParsedRequestBody;
}

/** E2EE encryption settings */
export interface E2EESettings {
  /** Enable end-to-end encryption for chat completions */
  enabled: boolean;
  /** Encryption algorithm (currently only 'ecdsa' is supported) */
  algorithm?: 'ecdsa';
  /** for attestation reports only */
  nearAiBaseURL?: string;
}
