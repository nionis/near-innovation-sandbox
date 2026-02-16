import type { AttestationRecord } from '@repo/packages-utils/contracts/attestations';
import type { Account, JsonRpcProvider } from 'near-api-js';

/**
 * Wrapper class for the attestations storage contract.
 * Replaces the old Contract class pattern from near-api-js v5.
 */
export class AttestationsStorageContract {
  constructor(
    private readonly provider: JsonRpcProvider,
    private readonly contractId: string,
    private readonly account?: Account
  ) {}

  /** View method: retrieve an attestation by proofHash */
  public async get(args: {
    proofHash: string;
  }): Promise<AttestationRecord | null> {
    const result = await this.provider.callFunction<AttestationRecord>({
      contractId: this.contractId,
      method: 'get',
      args,
    });
    return result ?? null;
  }

  /** View method: check if an attestation exists */
  public async exists(args: { proofHash: string }): Promise<boolean> {
    const result = await this.provider.callFunction<boolean>({
      contractId: this.contractId,
      method: 'exists',
      args,
    });
    return result ?? false;
  }

  /** Change method: store an attestation on-chain */
  public async store(args: {
    proofHash: string;
    timestamp: number;
  }): Promise<string> {
    if (!this.account) throw new Error('account not set');
    const response = await this.account.callFunctionRaw({
      contractId: this.contractId,
      methodName: 'store',
      args,
    });
    return response.transaction.hash;
  }
}
