import type { AttestationRecord } from '@repo/contracts-attestations/types';
import type { Account, JsonRpcProvider } from 'near-api-js';

/**
 * Wrapper class for the attestations storage contract.
 * Replaces the old Contract class pattern from near-api-js v5.
 */
export class AttestationsStorageContract {
  constructor(
    private readonly account: Account,
    private readonly provider: JsonRpcProvider,
    private readonly contractId: string
  ) {}

  /** View method: retrieve an attestation by proofHash */
  async get(args: { proofHash: string }): Promise<AttestationRecord | null> {
    const result = await this.provider.callFunction<AttestationRecord>({
      contractId: this.contractId,
      method: 'get',
      args,
    });
    return result ?? null;
  }

  /** View method: check if an attestation exists */
  async exists(args: { proofHash: string }): Promise<boolean> {
    const result = await this.provider.callFunction<boolean>({
      contractId: this.contractId,
      method: 'exists',
      args,
    });
    return result ?? false;
  }

  /** Change method: store an attestation on-chain */
  async store(args: { proofHash: string; timestamp: number }): Promise<string> {
    const result = await this.account.callFunction<string>({
      contractId: this.contractId,
      methodName: 'store',
      args,
    });
    return result;
  }
}
