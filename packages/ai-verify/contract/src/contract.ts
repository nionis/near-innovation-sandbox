import { NearBindgen, near, call, view, LookupMap } from "near-sdk-js";

interface ProofRecord {
  timestamp: number;
  stored_by: string;
}

@NearBindgen({})
class ProofStorage {
  proofs: LookupMap<ProofRecord> = new LookupMap<ProofRecord>("p");

  @call({})
  storeProof({
    proofHash,
    timestamp,
  }: {
    proofHash: string;
    timestamp: number;
  }): string {
    const storedBy = near.predecessorAccountId();

    this.proofs.set(proofHash, {
      timestamp,
      stored_by: storedBy,
    });

    near.log(`Proof stored: ${proofHash} by ${storedBy} at ${timestamp}`);
    return proofHash;
  }

  @view({})
  getProof({ proofHash }: { proofHash: string }): ProofRecord | null {
    return this.proofs.get(proofHash);
  }

  @view({})
  proofExists({ proofHash }: { proofHash: string }): boolean {
    return this.proofs.get(proofHash) !== null;
  }
}
