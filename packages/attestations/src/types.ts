import type {
  NearBlockchainNetwork,
  NearAIChatModelId,
} from '@repo/packages-near';

/** NEAR blockchain configuration */
export interface BlockchainConfig {
  networkId: NearBlockchainNetwork;
  privateKey: string;
  accountId: string;
  contractId: string;
}

/** verifiable receipt for AI-generated content */
export interface Receipt {
  version: string;
  timestamp: string;
  model: NearAIChatModelId;
  prompt: string;
  content?: string;
  requestHash: string;
  responseHash: string;
  signature: string;
  signingAddress: string;
  signingAlgo: string;
  output: string;
}

/** attestation response from NEAR AI Cloud */
export interface Attestation {
  gateway_attestation: GatewayAttestation;
  model_attestations: ModelAttestation[];
}

interface GatewayAttestation {
  signing_address: string;
  signing_algo: string;
  intel_quote: string;
  event_log: string; // JSON string of EventLogEntry[]
  report_data: string;
  request_nonce: string;
  info: AttestationInfo;
  vpc: VpcInfo;
}

interface AttestationInfo {
  app_cert: string;
  app_id: string;
  app_name: string;
  compose_hash: string;
  device_id: string;
  instance_id: string;
  key_provider_info: string; // JSON string
  mr_aggregated: string;
  os_image_hash: string;
  tcb_info: TcbInfo;
  vm_config: string; // JSON string
}

interface TcbInfo {
  [key: string]: unknown;
}

interface VpcInfo {
  vpc_server_app_id: string;
  vpc_hostname: string;
}

export interface ModelAttestation {
  event_log: EventLogEntry[];
  info: AttestationInfo;
  intel_quote: string;
  nvidia_payload: string; // JSON string
  request_nonce: string;
  signing_address: string;
  signing_algo: string;
  signing_public_key: string;
}

interface EventLogEntry {
  imr: number;
  event_type: number;
  digest: string;
  event: string;
  event_payload: string;
}

/** signature response from near.ai API */
export interface SignatureResponse {
  text: string;
  signature: string;
  signing_address: string;
  signing_algo: string;
}

/** verification result */
export interface VerificationResult {
  valid: boolean;
  message?: string;
}

/** verification result for model and gateway attestation */
export type ModelAndGatewayVerificationResult = {
  model_gpu: VerificationResult;
  model_tdx: VerificationResult;
  model_compose: VerificationResult;
  gateway_tdx: VerificationResult;
  gateway_compose: VerificationResult;
  gateway_sigstore: VerificationResult;
};

/** all verification results */
export type AllVerificationResults = {
  chat: VerificationResult;
  result: VerificationResult;
} & ModelAndGatewayVerificationResult;
