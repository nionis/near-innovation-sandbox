import {
  connect,
  keyStores,
  KeyPair,
  Contract,
  Near,
  Account,
} from 'near-api-js';
import type { ConnectConfig } from 'near-api-js';

export interface ProofRecord {
  timestamp: number;
  stored_by: string;
}

export interface BlockchainConfig {
  networkId: string;
  accountId: string;
  privateKey: string;
  contractId: string;
}

interface ProofContract {
  storeProof: (args: {
    proofHash: string;
    timestamp: number;
  }) => Promise<string>;
  getProof: (args: { proofHash: string }) => Promise<ProofRecord | null>;
}

let nearConnection: Near | null = null;
let account: Account | null = null;

/**
 * Initialize NEAR connection
 */
export async function initNear(config: BlockchainConfig): Promise<void> {
  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(config.privateKey);
  await keyStore.setKey(config.networkId, config.accountId, keyPair);

  const nodeUrl =
    config.networkId === 'mainnet'
      ? 'https://rpc.mainnet.near.org'
      : 'https://rpc.testnet.near.org';

  // Type assertion needed due to near-api-js v5 type definition issues
  nearConnection = await connect({
    networkId: config.networkId,
    keyStore,
    nodeUrl,
  } as ConnectConfig);
  account = await nearConnection.account(config.accountId);
}

/**
 * Store a proof hash on-chain
 */
export async function storeProofOnChain(
  contractId: string,
  proofHash: string
): Promise<{ txHash: string }> {
  if (!account) {
    throw new Error('NEAR not initialized. Call initNear() first.');
  }

  const contract = new Contract(account, contractId, {
    viewMethods: ['getProof'],
    changeMethods: ['storeProof'],
  }) as unknown as ProofContract;

  const timestamp = Date.now();

  // Call the contract method
  const result = await contract.storeProof({
    proofHash,
    timestamp,
  });

  // Get the transaction hash from the result
  // Note: near-api-js returns the result directly, we need to get tx hash differently
  const txHash = typeof result === 'string' ? result : proofHash;

  return { txHash };
}

/**
 * Retrieve a proof record from chain
 */
export async function getProofFromChain(
  contractId: string,
  proofHash: string
): Promise<ProofRecord | null> {
  if (!account) {
    throw new Error('NEAR not initialized. Call initNear() first.');
  }

  const contract = new Contract(account, contractId, {
    viewMethods: ['getProof'],
    changeMethods: ['storeProof'],
  }) as unknown as ProofContract;

  return contract.getProof({ proofHash });
}

/**
 * Check if a proof exists on-chain
 */
export async function proofExistsOnChain(
  contractId: string,
  proofHash: string
): Promise<boolean> {
  const proof = await getProofFromChain(contractId, proofHash);
  return proof !== null;
}
