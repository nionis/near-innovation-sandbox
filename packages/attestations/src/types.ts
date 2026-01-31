import type {
  NearBlockchainNetwork,
  NearAIChatModelId,
} from '@repo/packages-near';

/** NEAR blockchain configuration */
export interface BlockchainConfig {
  networkId: NearBlockchainNetwork;
  privateKey: string;
  accountId: string;
  contractId: string;
}

/** verifiable receipt for AI-generated content */
export interface Receipt {
  version: string;
  timestamp: string;
  model: NearAIChatModelId;
  prompt: string;
  content?: string;
  requestHash: string;
  responseHash: string;
  signature: string;
  signingAddress: string;
  signingAlgo: string;
  output: string;
}
