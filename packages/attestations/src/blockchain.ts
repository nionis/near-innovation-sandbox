import type { BlockchainConfig } from './types.js';
import type { AttestationRecord } from '@repo/contracts-attestations/types';
import {
  type KeyPairString,
  JsonRpcProvider,
  Account,
  KeyPairSigner,
} from 'near-api-js';
import { NEAR_BLOCKCHAIN_RPC_URLS } from '@repo/packages-near';
import { AttestationsStorageContract } from './contract.js';

/** blockchain wrapper for NEAR AttestationsStorage contract */
export class AttestationsBlockchain {
  private readonly config: BlockchainConfig;
  private provider?: JsonRpcProvider;
  private contract?: AttestationsStorageContract;
  private account?: Account;

  constructor(config: BlockchainConfig) {
    this.config = config;

    const nodeUrl =
      this.config.networkId === 'mainnet'
        ? NEAR_BLOCKCHAIN_RPC_URLS.mainnet
        : NEAR_BLOCKCHAIN_RPC_URLS.testnet;

    this.provider = new JsonRpcProvider({ url: nodeUrl });

    if (this.config.privateKey && this.config.accountId) {
      const signer = KeyPairSigner.fromSecretKey(
        this.config.privateKey as KeyPairString
      );
      this.account = new Account(this.config.accountId, this.provider, signer);
    }

    this.contract = new AttestationsStorageContract(
      this.provider,
      this.config.contractId,
      this.account
    );
  }

  public get initialized(): boolean {
    return !!this.provider && !!this.contract;
  }

  /** store an attestation on-chain */
  public async storeAttestationRecord(
    proofHash: string,
    timestamp: number
  ): Promise<{ txHash: string }> {
    if (!this.initialized) {
      throw new Error('AttestationsBlockchain not initialized');
    }

    const contract = this.contract!;
    const result = await contract.store({
      timestamp,
      proofHash,
    });

    return { txHash: result };
  }

  /** retrieve an attestation from chain */
  public async getAttestationRecord(
    proofHash: string
  ): Promise<AttestationRecord | null> {
    if (!this.initialized) {
      throw new Error('AttestationsBlockchain not initialized');
    }
    const contract = this.contract!;
    return contract.get({ proofHash });
  }

  /** check if an attestation exists on-chain */
  public async existsAttestationRecord(proofHash: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('AttestationsBlockchain not initialized');
    }
    const contract = this.contract!;
    return contract.exists({ proofHash });
  }
}
