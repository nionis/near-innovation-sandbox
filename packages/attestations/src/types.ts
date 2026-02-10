import type {
  NearBlockchainNetwork,
  NearAIChatModelId,
} from '@repo/packages-utils/near';

/** NEAR blockchain configuration */
export type BlockchainConfig = {
  networkId: NearBlockchainNetwork;
  contractId: string;
  privateKey?: string;
  accountId?: string;
};

/** options for attestations API */
export type AttestationsOptions = {
  fetch?: typeof fetch;
};

/** input data for attestation */
export type AttestInput = {
  chatId: string;
  requestBody: string;
  responseBody: string;
};

/** output data for attestation */
export type AttestOutput = {
  requestHash: string;
  responseHash: string;
  signature: string;
  signingAddress: string;
  signingAlgo: string;
};

/** input data for verification */
export type VerifyInput = {
  model: NearAIChatModelId;
  requestBody: string;
  responseBody: string;
  signature: string;
  signingAddress: string;
  signingAlgo: string;
  timestamp: number;
};

/** all verification results */
export type VerifyOutput = {
  chat: VerificationResult;
  notorized: VerificationResult;
  result: VerificationResult;
} & ModelAndGatewayVerificationResult;

/** compact chat export that can be stored and verified later */
export type ChatExport = VerifyInput & {
  version: string;
  timestamp: number;
  proofHash: string;
  txHash: string;
  ourPassphrase: string[];
} & (
    | {
        e2ee: true;
        modelsPublicKey: string;
        ephemeralPrivateKeys: string[];
      }
    | {
        e2ee: false;
        modelsPublicKey: undefined;
        ephemeralPrivateKeys: undefined;
      }
  );

/** pre-formatted chat that can be displayed to the user */
export type Chat = {
  prompt: string;
  content?: string;
  output: string;
  verification: VerifyOutput;
};

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
};

/** verification result for E2EE */
export type E2EEVerificationResult = {
  outgoing_enc: VerificationResult;
  incoming_enc: VerificationResult;
};

// below are API types for NEAR AI Cloud and NRAS

/** attestation response from NEAR AI Cloud */
export interface Attestation {
  gateway_attestation: GatewayAttestation;
  model_attestations: ModelAttestation[];
}

export interface GatewayAttestation {
  signing_address: string;
  signing_algo: string;
  intel_quote: string;
  event_log: string; // JSON string of EventLogEntry[]
  report_data: string;
  request_nonce: string;
  info: AttestationInfo;
  vpc: VpcInfo;
}

export interface AttestationInfo {
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
