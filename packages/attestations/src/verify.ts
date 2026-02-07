import type {
  ModelAndGatewayVerificationResult,
  ModelAttestation,
  GatewayAttestation,
  AttestationInfo,
  VerificationResult,
} from './types.js';
import type { NearAIChatModelId } from '@repo/packages-utils/near';
import { getCollateralAndVerify, type TcbStatus } from '@phala/dcap-qvl';
import { fetchAttestation } from './verify-utils.js';
import { verifySignature } from './crypto.js';
import { randomNonce, base64UrlToBase64 } from '@repo/packages-utils/crypto';

/** verify model attestation */
export async function verifyChatAttestation(input: {
  requestHash: string;
  responseHash: string;
  signature: string;
  signingAddress: string;
}): Promise<VerificationResult> {
  // verify the ECDSA signature
  const signatureText = `${input.requestHash}:${input.responseHash}`;

  const signatureResult = verifySignature(
    signatureText,
    input.signature,
    input.signingAddress
  );

  if (!signatureResult.valid) {
    return {
      valid: false,
      message: 'signature verification failed',
    };
  }

  const addressMatch =
    signatureResult.recoveredAddress.toLowerCase() ===
    input.signingAddress.toLowerCase();

  if (!addressMatch) {
    return {
      valid: false,
      message: 'recovered address does not match signing address',
    };
  }

  return {
    valid: true,
    message: undefined,
  };
}

export async function verifyModelAndGatewayAttestation(
  input: {
    model: NearAIChatModelId;
    signingAddress: string;
    requestHash: string;
    responseHash: string;
  },
  nearAiBaseURL: string,
  nrasUrl: string
): Promise<ModelAndGatewayVerificationResult> {
  const nonce = randomNonce();
  const attestation = await fetchAttestation(
    nearAiBaseURL,
    input.model,
    nonce,
    input.signingAddress
  );

  const {
    gateway_attestation: gatewayAttestation,
    model_attestations: modelAttestations,
  } = attestation;
  const modelAttestation = modelAttestations.find((a) => {
    return (
      a.signing_address.toLowerCase() === input.signingAddress.toLowerCase()
    );
  });

  if (!modelAttestation) {
    throw new Error('model attestation not found');
  }

  const [modelVerifications, gatewayVerifications] = await Promise.all([
    verifyModelAttestation(modelAttestation, nonce, nrasUrl),
    verifyGatewayAttestation(gatewayAttestation, nonce),
  ]);

  return {
    ...modelVerifications,
    ...gatewayVerifications,
  };
}

async function verifyModelAttestation(
  attestation: ModelAttestation,
  nonce: string,
  nrasUrl: string
): Promise<
  Pick<
    ModelAndGatewayVerificationResult,
    'model_gpu' | 'model_tdx' | 'model_compose'
  >
> {
  const model_gpu = await verifyGpuAttestation(
    attestation.nvidia_payload,
    nonce,
    nrasUrl
  );

  const model_tdx = model_gpu.valid
    ? await verifyTdxQuote(
        attestation.intel_quote,
        nonce,
        attestation.signing_address
      )
    : {
        valid: false,
        message:
          'could not verify model_tdx because model_gpu verification failed',
      };

  const expectedMrConfig = model_tdx.mrConfigId!;

  const model_compose =
    model_gpu && model_tdx.valid
      ? verifyComposeManifest(attestation.info, expectedMrConfig)
      : {
          valid: false,
          message:
            'could not verify model_compose because model_gpu or model_tdx verification failed',
        };

  return {
    model_gpu,
    model_tdx,
    model_compose,
  };
}

async function verifyGpuAttestation(
  payload: string,
  expectedNonce: string,
  nrasUrl: string
): Promise<VerificationResult> {
  const response = await fetch(`${nrasUrl}/attest/gpu`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: payload,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA NRAS returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  // NVIDIA returns an array with JWT tokens
  // The first element is ["JWT", "token_string"]
  // We need to decode the JWT to check the attestation result
  if (!Array.isArray(result) || result.length < 1) {
    throw new Error('Invalid NRAS response format');
  }

  const [jwtType, jwtToken] = result[0];
  if (jwtType !== 'JWT' || !jwtToken) {
    throw new Error('Missing JWT in NRAS response');
  }

  // Decode JWT payload (base64url encoded, second part of the token)
  if (typeof jwtToken !== 'string') {
    throw new Error('JWT token is not a string');
  }
  const parts = jwtToken.split('.');
  if (parts.length !== 3 || typeof parts[1] !== 'string') {
    throw new Error('Invalid JWT format');
  }

  // convert base64url to base64 for browser compatibility
  const base64 = base64UrlToBase64(parts[1]);
  // decode base64 to utf-8
  const output = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));

  const overallResult = output['x-nvidia-overall-att-result'] === true;
  const nonceMatch = output['eat_nonce'] === expectedNonce;
  const valid = overallResult && nonceMatch;

  return {
    valid: valid,
    message: valid
      ? undefined
      : `overallResult: ${overallResult}, nonceMatch: ${nonceMatch}`,
  };
}

async function verifyTdxQuote(
  quote: string,
  expectedNonce: string,
  expectedSigningAddress: string
): Promise<VerificationResult & { mrConfigId?: string }> {
  // Acceptable TCB statuses for attestation
  const ACCEPTABLE_TCB_STATUSES: TcbStatus[] = ['UpToDate'];

  // Decode the base64 quote to bytes
  const quoteBytes = Buffer.from(quote, 'hex');

  // Verify the quote using Intel's attestation infrastructure
  const verifiedReport = await getCollateralAndVerify(quoteBytes);

  // Check TCB status
  if (!ACCEPTABLE_TCB_STATUSES.includes(verifiedReport.status)) {
    return {
      valid: false,
      message: `TCB status not acceptable: ${verifiedReport.status}`,
    };
  }

  // Extract the TDX report (supports both TD10 and TD15 formats)
  const tdReport =
    verifiedReport.report.asTd10() ?? verifiedReport.report.asTd15()?.base;

  if (!tdReport) {
    return {
      valid: false,
      message: 'Quote is not a valid TDX quote',
    };
  }

  // The report data (64 bytes) contains:
  // - First 32 bytes: keccak256 hash of the signing address
  // - Last 32 bytes: the nonce
  const reportData = Buffer.from(tdReport.reportData);
  const addressHash = reportData.subarray(0, 32).toString('hex');
  const embeddedNonce = reportData.subarray(32, 64).toString('hex');

  // Verify the nonce matches
  if (embeddedNonce !== expectedNonce) {
    return {
      valid: false,
      message: `Nonce mismatch: expected ${expectedNonce}, got ${embeddedNonce}`,
    };
  }

  const signingAddress = '0x' + addressHash.slice(0, 40);

  if (
    signingAddress.toLocaleLowerCase() !==
    expectedSigningAddress.toLocaleLowerCase()
  ) {
    return {
      valid: false,
      message: `Signing address binding mismatch`,
    };
  }

  return {
    valid: true,
    mrConfigId: Buffer.from(tdReport.mrConfigId).toString('hex'),
    message: undefined,
  };
}

function verifyComposeManifest(
  composeManifest: AttestationInfo,
  expectedMrConfig: string
): VerificationResult {
  const valid = expectedMrConfig
    .toLowerCase()
    .includes(composeManifest.compose_hash.toLowerCase());

  return {
    valid,
    message: valid ? undefined : `compose manifest hash mismatch`,
  };
}

async function verifyGatewayAttestation(
  attestation: GatewayAttestation,
  expectedNonce: string
): Promise<
  Pick<ModelAndGatewayVerificationResult, 'gateway_tdx' | 'gateway_compose'>
> {
  const gateway_tdx = await verifyTdxQuote(
    attestation.intel_quote,
    expectedNonce,
    attestation.signing_address
  );

  const gateway_compose = gateway_tdx.valid
    ? verifyComposeManifest(attestation.info, gateway_tdx.mrConfigId!)
    : {
        valid: false,
        message:
          'could not verify gateway_compose because gateway_tdx verification failed',
      };

  return {
    gateway_tdx,
    gateway_compose,
  };
}
