import type {
  Receipt,
  ModelAndGatewayVerificationResult,
  ModelAttestation,
  VerificationResult,
} from './types.js';
import { randomBytes } from 'crypto';
import { fetchAttestation } from './verify-utils.js';
import { verifySignature } from './crypto.js';
import { getCollateralAndVerify, type TcbStatus } from '@phala/dcap-qvl';

/** verify model attestation */
export async function verifyChatAttestation(
  receipt: Receipt
): Promise<VerificationResult> {
  // verify the ECDSA signature
  const signatureText = `${receipt.requestHash}:${receipt.responseHash}`;

  const signatureResult = verifySignature(
    signatureText,
    receipt.signature,
    receipt.signingAddress
  );

  if (!signatureResult.valid) {
    return {
      valid: false,
      message: 'signature verification failed',
    };
  }

  const addressMatch =
    signatureResult.recoveredAddress.toLowerCase() ===
    receipt.signingAddress.toLowerCase();

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
  receipt: Receipt
): Promise<ModelAndGatewayVerificationResult> {
  const nonce = randomBytes(32).toString('hex');
  const attestation = await fetchAttestation(receipt.model, nonce);

  const {
    gateway_attestation: gatewayAttestation,
    model_attestations: modelAttestations,
  } = attestation;
  const modelAttestation = modelAttestations.find((a) => {
    return (
      a.signing_address.toLowerCase() === receipt.signingAddress.toLowerCase()
    );
  });

  const { model_gpu, model_tdx } = modelAttestation
    ? await verifyModelAttestation(receipt, nonce, modelAttestation)
    : {
        model_gpu: {
          valid: false,
          message: 'model attestation not found',
        },
        model_tdx: {
          valid: false,
          message: 'model attestation not found',
        },
      };

  return {
    model_gpu,
    model_tdx,
    model_compose: {
      valid: false,
      message: undefined,
    },
    gateway_tdx: {
      valid: false,
      message: undefined,
    },
    gateway_compose: {
      valid: false,
      message: undefined,
    },
    gateway_sigstore: {
      valid: false,
      message: undefined,
    },
  };
}

async function verifyModelAttestation(
  receipt: Receipt,
  nonce: string,
  attestation: ModelAttestation
): Promise<Pick<ModelAndGatewayVerificationResult, 'model_gpu' | 'model_tdx'>> {
  const model_gpu = await verifyGpuAttestation(
    attestation.nvidia_payload,
    nonce
  );

  const model_tdx = await verifyTdxQuote(
    attestation.intel_quote,
    nonce,
    attestation.signing_address
  );

  return {
    model_gpu,
    model_tdx,
  };
}

async function verifyGpuAttestation(
  payload: string,
  expectedNonce: string
): Promise<VerificationResult> {
  const NRAS_URL = 'https://nras.attestation.nvidia.com/v3/attest/gpu';

  try {
    const response = await fetch(NRAS_URL, {
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

    const output = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    const overallResult = output['x-nvidia-overall-att-result'] === true;
    const nonceMatch = output['eat_nonce'] === expectedNonce;
    const valid = overallResult && nonceMatch;

    return {
      valid: valid,
      message: valid
        ? undefined
        : `overallResult: ${overallResult}, nonceMatch: ${nonceMatch}`,
    };
  } catch (error) {
    return {
      valid: false,
      message: `GPU attestation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function verifyTdxQuote(
  quote: string,
  expectedNonce: string,
  expectedSigningAddress: string
): Promise<VerificationResult> {
  // Acceptable TCB statuses for attestation
  const ACCEPTABLE_TCB_STATUSES: TcbStatus[] = [
    'UpToDate',
    'SWHardeningNeeded',
    'ConfigurationNeeded',
    'ConfigurationAndSWHardeningNeeded',
  ];

  try {
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
      message: undefined,
    };
  } catch (error) {
    return {
      valid: false,
      message: `TDX quote verification error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
