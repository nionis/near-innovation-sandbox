/** E2EE (End-to-End Encryption) module for NEAR AI Provider */

export { generateKeyPair, eciesEncrypt, eciesDecrypt } from './crypto.js';
export type { KeyPair } from './crypto.js';

export {
  fetchModelPublicKey,
  getModelPublicKey,
  clearModelKeyCache,
  invalidateModelKey,
} from './model-key.js';
export type { ModelKeyInfo } from './model-key.js';

export {
  createE2EEFetch,
  getE2EECapturePromise,
  clearE2EECapture,
} from './middleware.js';
export type { E2EEContext, E2EECapturedData } from './middleware.js';
