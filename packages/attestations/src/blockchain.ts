import type { BlockchainConfig } from './types.js';
import type { AttestationRecord } from '@repo/contracts-attestations/types';
import { AttestationsStorageContract } from './contract.js';
import {
  type KeyPairString,
  JsonRpcProvider,
  Account,
  KeyPairSigner,
} from 'near-api-js';

/** blockchain wrapper for NEAR AttestationsStorage contract */
export class AttestationsBlockchain {
  private readonly config: BlockchainConfig;
  private provider: JsonRpcProvider | null = null;
  private account: Account | null = null;
  private contract: AttestationsStorageContract | null = null;

  constructor(config: BlockchainConfig) {
    this.config = config;
  }

  public get initialized(): boolean {
    return (
      this.provider !== null && this.account !== null && this.contract !== null
    );
  }

  public async init(): Promise<void> {
    const nodeUrl =
      this.config.networkId === 'mainnet'
        ? 'https://rpc.mainnet.near.org'
        : 'https://rpc.testnet.near.org';

    this.provider = new JsonRpcProvider({ url: nodeUrl });
    const signer = KeyPairSigner.fromSecretKey(
      this.config.privateKey as KeyPairString
    );

    this.account = new Account(this.config.accountId, this.provider, signer);

    this.contract = new AttestationsStorageContract(
      this.account,
      this.provider,
      this.config.contractId
    );
  }

  /** store an attestation on-chain */
  public async storeAttestation(
    proofHash: string
  ): Promise<{ txHash: string }> {
    if (!this.initialized) {
      throw new Error('NEAR not initialized. Call init() first.');
    }

    const contract = this.contract!;
    const timestamp = Date.now();

    console.log(`Storing attestation on-chain`, {
      timestamp,
      proofHash,
    });

    // Call the contract method
    const result = await contract.store({
      timestamp,
      proofHash,
    });

    console.log(`Attestation stored on-chain`, result);

    return { txHash: result };
  }

  /** retrieve an attestation from chain */
  public async getAttestation(
    proofHash: string
  ): Promise<AttestationRecord | null> {
    if (!this.initialized) {
      throw new Error('NEAR not initialized. Call init() first.');
    }
    const contract = this.contract!;
    return contract.get({ proofHash });
  }

  /** check if an attestation exists on-chain */
  public async existsAttestation(proofHash: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('NEAR not initialized. Call init() first.');
    }
    const contract = this.contract!;
    return contract.exists({ proofHash });
  }
}
