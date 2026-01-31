import type { AttestationRecord } from './types';
import { NearBindgen, LookupMap, near, call, view, bytes } from 'near-sdk-js';

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
    const ONE_MIN = BigInt(1 * 60 * 1000);
    const blockTimestampMs = Number(near.blockTimestamp() / BigInt(1_000_000));

    if (timestamp > near.blockTimestamp() + ONE_MIN) {
      near.panicUtf8(
        bytes(
          `Timestamp is too far in the future. Provided: ${timestamp}, current: ${blockTimestampMs}`
        )
      );
    }

    const storedBy = near.signerAccountId();

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
