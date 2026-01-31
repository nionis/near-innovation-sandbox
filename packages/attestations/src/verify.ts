import type {
  Receipt,
  ModelAndGatewayVerificationResult,
  ModelAttestation,
  VerificationResult,
} from './types.js';
import { randomBytes } from 'crypto';
import { fetchAttestation } from './verify-utils.js';
import { verifySignature } from './crypto.js';

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

  const { model_gpu } = modelAttestation
    ? await verifyModelAttestation(receipt, nonce, modelAttestation)
    : {
        model_gpu: {
          valid: false,
          message: 'model attestation not found',
        },
      };

  return {
    model_gpu,
    model_tdx: {
      valid: false,
      message: undefined,
    },
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
  modelAttestation: ModelAttestation
): Promise<Pick<ModelAndGatewayVerificationResult, 'model_gpu'>> {
  const model_gpu = await verifyGpuAttestation(
    modelAttestation.nvidia_payload,
    nonce
  );

  return {
    model_gpu,
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

// async function verifyTdxQuote(
//   intelQuote: unknown,
//   expectedNonce: string,
//   expectedSigningAddress?: string
// ): Promise<VerificationResult> {}
