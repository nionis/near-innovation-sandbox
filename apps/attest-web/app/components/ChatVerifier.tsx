'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  ChatExport,
  VerifyOutput,
  VerificationResult,
} from '@repo/packages-attestations';
import type { NearBlockchainNetwork } from '@repo/packages-utils/near';
import { verify } from '@repo/packages-attestations';
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain';
import * as SMART_CONTRACTS from '@repo/packages-utils/contracts/attestations';
import { fetchViaHost } from '../lib/utils';

const NETWORK_ID: NearBlockchainNetwork = 'testnet';
const CONTRACT_ID = SMART_CONTRACTS[NETWORK_ID].contractId;

type VerifyState =
  | { status: 'idle' }
  | { status: 'loading'; step: string }
  | { status: 'success'; results: VerifyOutput }
  | { status: 'error'; message: string };

interface ChatVerifierProps {
  onVerificationComplete?: (results: VerifyOutput) => void;
  initialJson?: string;
}

export function ChatVerifier({
  onVerificationComplete,
  initialJson,
}: ChatVerifierProps) {
  const [chatExportJson, setChatExportJson] = useState(initialJson || '');
  const [verifyState, setVerifyState] = useState<VerifyState>({
    status: 'idle',
  });

  // Update chatExportJson when initialJson changes
  useEffect(() => {
    if (initialJson) {
      setChatExportJson(initialJson);
    }
  }, [initialJson]);

  const verifyChat = useCallback(async (chatExport: ChatExport) => {
    const blockchain = new AttestationsBlockchain({
      networkId: NETWORK_ID,
      contractId: CONTRACT_ID,
    });

    return verify(chatExport, blockchain, { fetch: fetchViaHost });
  }, []);

  const handleVerify = async () => {
    // Parse JSON
    let chatExport: ChatExport;
    try {
      chatExport = JSON.parse(chatExportJson);
    } catch {
      setVerifyState({ status: 'error', message: 'Invalid JSON format' });
      return;
    }

    // Validate required fields
    const requiredFields: (keyof ChatExport)[] = [
      'timestamp',
      'model',
      'signature',
      'signingAddress',
      'signingAlgo',
      'txHash',
    ];

    for (const field of requiredFields) {
      if (chatExport[field] === undefined || chatExport[field] === null) {
        setVerifyState({
          status: 'error',
          message: `Missing required field: ${field}`,
        });
        return;
      }
    }

    setVerifyState({ status: 'loading', step: 'Initializing verification...' });

    try {
      setVerifyState({ status: 'loading', step: 'Verifying...' });
      const results = await verifyChat(chatExport);

      setVerifyState({ status: 'success', results });
      onVerificationComplete?.(results);
    } catch (error) {
      console.error('Verification failed:', error);
      setVerifyState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Verification failed',
      });
    }
  };

  const handleClear = () => {
    setChatExportJson('');
    setVerifyState({ status: 'idle' });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Input Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocumentIcon />
            <label
              htmlFor="receipt-json"
              className="text-sm font-medium text-purple-700 dark:text-purple-300"
            >
              Receipt JSON
            </label>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-300 dark:text-purple-600">|</span>
            <button
              onClick={handleClear}
              className="text-sm text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        <textarea
          id="receipt-json"
          value={chatExportJson}
          onChange={(e) => {
            setChatExportJson(e.target.value);
            if (verifyState.status === 'error') {
              setVerifyState({ status: 'idle' });
            }
          }}
          placeholder="Paste your receipt JSON here..."
          className="h-64 w-full resize-none rounded-xl border border-purple-200 bg-white/80 backdrop-blur-sm p-4 font-mono text-sm text-purple-900 placeholder:text-purple-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200 shadow-sm dark:border-purple-800 dark:bg-[oklch(0.2_0.04_285)]/80 dark:text-purple-100 dark:placeholder:text-purple-600 dark:focus:border-purple-600 dark:focus:ring-purple-800"
        />
      </div>

      {/* Verify Button */}
      <button
        onClick={handleVerify}
        disabled={!chatExportJson.trim() || verifyState.status === 'loading'}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 text-white font-medium transition-all hover:from-purple-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
      >
        {verifyState.status === 'loading' ? (
          <>
            <LoadingSpinner />
            {verifyState.step}
          </>
        ) : (
          <>
            <ShieldCheckIcon />
            Verify Receipt
          </>
        )}
      </button>

      {/* Results Section */}
      {verifyState.status === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 backdrop-blur-sm p-4 shadow-lg dark:border-red-900/50 dark:bg-red-950/80">
          <div className="flex items-center gap-2">
            <ErrorIcon />
            <span className="font-medium text-red-800 dark:text-red-200">
              Verification Error
            </span>
          </div>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {verifyState.message}
          </p>
        </div>
      )}

      {verifyState.status === 'success' && (
        <VerificationResults results={verifyState.results} />
      )}
    </div>
  );
}

function VerificationResults({ results }: { results: VerifyOutput }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Overall Result */}
      <div
        className={`rounded-xl border p-4 shadow-lg backdrop-blur-sm ${
          results.result.valid
            ? 'border-green-200 bg-green-50/80 dark:border-green-900/50 dark:bg-green-950/80'
            : 'border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/80'
        }`}
      >
        <div className="flex items-center gap-2">
          {results.result.valid ? <SuccessIcon /> : <ErrorIcon />}
          <span
            className={`text-lg font-semibold ${
              results.result.valid
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }`}
          >
            {results.result.valid ? '✓ Verified Successfully' : 'Verification Failed'}
          </span>
        </div>
        {results.result.message && (
          <p
            className={`mt-2 text-sm ${
              results.result.valid
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}
          >
            {results.result.message}
          </p>
        )}
      </div>

      {/* Detailed Results */}
      <div className="rounded-xl border border-purple-200 bg-white/80 backdrop-blur-sm shadow-lg dark:border-purple-800/50 dark:bg-[oklch(0.2_0.04_285)]/80">
        <div className="border-b border-purple-200 px-4 py-3 dark:border-purple-800/50">
          <h3 className="font-medium text-purple-900 dark:text-purple-100">
            Verification Details
          </h3>
        </div>
        <div className="divide-y divide-purple-200 dark:divide-purple-800/50">
          <VerificationRow label="Chat Attestation" result={results.chat} />
          <VerificationRow
            label="Blockchain Notarization"
            result={results.notorized}
          />
          <VerificationRow
            label="Model GPU Attestation"
            result={results.model_gpu}
          />
          <VerificationRow
            label="Model TDX Attestation"
            result={results.model_tdx}
          />
          <VerificationRow
            label="Model Compose Attestation"
            result={results.model_compose}
          />
          <VerificationRow
            label="Gateway TDX Attestation"
            result={results.gateway_tdx}
          />
          <VerificationRow
            label="Gateway Compose Attestation"
            result={results.gateway_compose}
          />
        </div>
      </div>
    </div>
  );
}

function VerificationRow({
  label,
  result,
}: {
  label: string;
  result: VerificationResult;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-purple-700 dark:text-purple-300">
          {label}
        </span>
        {result.message && (
          <span className="text-xs text-purple-500 dark:text-purple-500">
            {result.message}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {result.valid ? (
          <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 shadow-sm dark:bg-green-900 dark:text-green-300">
            <CheckIcon />
            Valid
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 shadow-sm dark:bg-red-900 dark:text-red-300">
            <XIcon />
            Invalid
          </span>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      className="h-4 w-4 text-purple-600 dark:text-purple-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg
      className="h-5 w-5 text-green-600 dark:text-green-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="h-5 w-5 text-red-600 dark:text-red-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="h-3 w-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
