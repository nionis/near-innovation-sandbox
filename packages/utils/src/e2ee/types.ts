import type { ModelMessage } from 'ai';
import type { NearAIChatModelId } from '../near/index.js';

/** a key pair */
export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/** a parsed request body */
export type ParsedRequestBody = {
  messages: ModelMessage[];
  model: NearAIChatModelId;
  stream: boolean;
};
