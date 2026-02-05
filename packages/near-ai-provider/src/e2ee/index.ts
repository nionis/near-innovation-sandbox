/** E2EE (End-to-End Encryption) module for NEAR AI Provider */

export type { KeyPair, E2EEContext, E2EECapturedData } from './types.js';

export { generateKeyPair, eciesEncrypt, eciesDecrypt } from './crypto.js';

export { ModelPublicKeys } from './model-public-keys.js';

export {
  createE2EEFetch,
  getE2EECapturePromise,
  clearE2EECapture,
} from './middleware.js';
