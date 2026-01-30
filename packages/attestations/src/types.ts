import type { NearBlockchainNetwork } from '@repo/packages-near';

/** NEAR blockchain configuration */
export interface BlockchainConfig {
  networkId: NearBlockchainNetwork;
  privateKey: string;
  accountId: string;
  contractId: string;
}
