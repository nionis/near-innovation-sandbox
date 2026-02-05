/** E2EE encryption settings */
export interface E2EESettings {
  /** Enable end-to-end encryption for chat completions */
  enabled: boolean;
  /** Encryption algorithm (currently only 'ecdsa' is supported) */
  algorithm?: 'ecdsa';
}
