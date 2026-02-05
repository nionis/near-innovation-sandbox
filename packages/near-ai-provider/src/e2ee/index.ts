/** E2EE (End-to-End Encryption) module for NEAR AI Provider */

export type { KeyPair } from './types.js';

export { generateKeyPair, eciesEncrypt, eciesDecrypt } from './crypto.js';

export { ModelPublicKeys } from './model-public-keys.js';

export {
  createE2EEFetch,
  getE2EECapturePromise,
  clearE2EECapture,
} from './middleware.js';
export type { E2EEContext, E2EECapturedData } from './middleware.js';
