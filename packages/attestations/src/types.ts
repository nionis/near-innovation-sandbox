import type { NearBlockchainNetwork } from '@repo/packages-near';

/** NEAR blockchain configuration */
export interface BlockchainConfig {
  networkId: NearBlockchainNetwork;
  privateKey: string;
  accountId: string;
  contractId: string;
}

/**
 * A verifiable receipt for AI-generated content
 */
export interface Receipt {
  version: string;
  timestamp: string;
  model: string;
  prompt: string;
  contentFile?: string;
  requestHash: string;
  responseHash: string;
  signature: string;
  signingAddress: string;
  signingAlgo: string;
  output: string;
  // onChain?: OnChainRecord;
}
