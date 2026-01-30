export type NearBlockchainNetwork = 'mainnet' | 'testnet';

export const NEAR_BLOCKCHAIN_RPC_URLS: Record<NearBlockchainNetwork, string> = {
  mainnet: 'https://rpc.mainnet.near.org',
  testnet: 'https://rpc.testnet.near.org',
};
