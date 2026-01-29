import type { AttestationRecord } from './types';
import { NearBindgen, LookupMap, near, call, view } from 'near-sdk-js';

@NearBindgen({})
class AttestationsStorage {
  records: LookupMap<AttestationRecord> = new LookupMap<AttestationRecord>('a');

  @call({})
  store({
    proofHash,
    timestamp,
  }: {
    proofHash: string;
    timestamp: number;
  }): string {
    const storedBy = near.predecessorAccountId();

    this.records.set(proofHash, {
      timestamp,
      stored_by: storedBy,
    });

    near.log(`record added: ${proofHash} by ${storedBy} at ${timestamp}`);
    return proofHash;
  }

  @view({})
  get({ proofHash }: { proofHash: string }): AttestationRecord | null {
    return this.records.get(proofHash);
  }

  @view({})
  exists({ proofHash }: { proofHash: string }): boolean {
    return this.records.get(proofHash) !== null;
  }
}
