/** testnet contract id */
export const testnet = {
  contractId: 'nis-attestations-02.testnet',
};

/** attestation record on chain */
export interface AttestationRecord {
  timestamp: number;
  stored_by: string;
}
