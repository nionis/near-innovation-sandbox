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
  }>;
}

/** a key pair */
export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/** E2EE context for a request */
export interface E2EEContext {
  /** Client's ephemeral key pair for this request */
  clientKeyPair: KeyPair;
  /** Model's public key (hex, 64 bytes) */
  modelPublicKey: string;
}

/** Captured E2EE request/response for attestation */
export interface E2EECapturedData {
  /** ephemeral passphrase for this request */
  passphrase: string[];
  /** The encrypted request body string sent to the server */
  requestBody: string;
  /** The raw encrypted response body string received from the server */
  responseBody: string;
  /** Chat completion ID extracted from response */
  id: string | null;
  /** Decrypted output text */
  output: string;
}
