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

/**
 * Result of verification checks
 */
export interface VerificationChecks {
  signatureValid: boolean;
  recoveredAddress: string;
  addressMatch: boolean;
  onChainExists?: boolean;
  onChainTimestamp?: number;
  onChainStoredBy?: string;
}

/**
 * Complete verification result
 */
export interface VerificationResult {
  valid: boolean;
  checks: VerificationChecks;
  errors: string[];
}
