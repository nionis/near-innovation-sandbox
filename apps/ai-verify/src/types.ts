export interface OnChainRecord {
  network: string;
  txHash: string;
  contractId: string;
  proofHash: string;
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
  onChain?: OnChainRecord;
}

/**
 * Options for generating AI content with attestation
 */
export interface GenerateOptions {
  model: string;
  prompt: string;
  content?: string;
  contentFile?: string;
  output?: string;
  skipOnChain?: boolean;
}

/**
 * Options for verifying a receipt
 */
export interface VerifyOptions {
  receiptFile: string;
  skipOnChain?: boolean;
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

/**
 * NEAR blockchain configuration
 */
export interface BlockchainConfig {
  networkId: string;
  accountId: string;
  privateKey: string;
  contractId: string;
}

/**
 * On-chain proof record
 */
export interface ProofRecord {
  timestamp: number;
  stored_by: string;
}

/**
 * Chat message format for AI requests
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Result from chat completion including metadata for attestation
 */
export interface ChatCompletionResult {
  chatId: string;
  model: string;
  requestHash: string;
  responseHash: string;
  output: string;
}
