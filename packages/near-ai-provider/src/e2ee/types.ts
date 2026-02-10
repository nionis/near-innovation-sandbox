import type { ModelMessage } from 'ai';

/** E2EE encryption settings */
export interface E2EESettings {
  /** Enable end-to-end encryption for chat completions */
  enabled: boolean;
  /** Encryption algorithm (currently only 'ecdsa' is supported) */
  algorithm?: 'ecdsa';
  /** for attestation reports only */
  nearAiBaseURL?: string;
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

/** a key pair */
export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/** E2EE context for a model */
export interface E2EEContext {
  modelsPublicKey: Uint8Array;
  encrypt: (messages: ModelMessage[]) => ModelMessage[];
  decrypt: (ourKeyPair: KeyPair, ciphertext: string) => string;
}
