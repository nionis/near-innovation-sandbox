/** NEAR blockchain configuration */
export interface BlockchainConfig {
  networkId: 'mainnet' | 'testnet';
  privateKey: string;
  accountId: string;
  contractId: string;
}
