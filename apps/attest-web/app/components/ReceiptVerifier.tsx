'use client';

import { useState, useCallback } from 'react';
import type {
  Receipt,
  AllVerificationResults,
  VerificationResult,
} from '@repo/packages-attestations';
import { verify } from '@repo/packages-attestations';
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain';
import * as SMART_CONTRACTS from '@repo/contracts-attestations/deployment';
import {
  type NearBlockchainNetwork,
  NEAR_AI_BASE_URL,
  NRAS_BASE_URL,
} from '@repo/packages-utils/near';

const NETWORK_ID: NearBlockchainNetwork = 'testnet';
const CONTRACT_ID = SMART_CONTRACTS[NETWORK_ID].contractId;

type VerifyState =
  | { status: 'idle' }
  | { status: 'loading'; step: string }
  | { status: 'success'; results: AllVerificationResults }
  | { status: 'error'; message: string };

interface ReceiptVerifierProps {
  onVerificationComplete?: (results: AllVerificationResults) => void;
}

export function ReceiptVerifier({
  onVerificationComplete,
}: ReceiptVerifierProps) {
  const [receiptJson, setReceiptJson] = useState('');
  const [verifyState, setVerifyState] = useState<VerifyState>({
    status: 'idle',
  });

  const verifyReceipt = useCallback(async (receipt: Receipt) => {
    const blockchain = new AttestationsBlockchain({
      networkId: NETWORK_ID,
      contractId: CONTRACT_ID,
    });

    return verify(receipt, blockchain, {
      // use local near.ai
      nearAiBaseURL: '/api/verify?url=' + NEAR_AI_BASE_URL,
      // use local nras
      nrasUrl: '/api/verify?url=' + NRAS_BASE_URL,
    });
  }, []);

  const handleVerify = async () => {
    // Parse JSON
    let receipt: Receipt;
    try {
      receipt = JSON.parse(receiptJson);
    } catch {
      setVerifyState({ status: 'error', message: 'Invalid JSON format' });
      return;
    }

    // Validate required fields
    const requiredFields: (keyof Receipt)[] = [
      'version',
      'timestamp',
      'model',
      'prompt',
      'requestHash',
      'responseHash',
      'signature',
      'signingAddress',
      'signingAlgo',
      'output',
      'proofHash',
    ];

    for (const field of requiredFields) {
      if (receipt[field] === undefined || receipt[field] === null) {
        setVerifyState({
          status: 'error',
          message: `Missing required field: ${field}`,
        });
        return;
      }
    }

    setVerifyState({ status: 'loading', step: 'Initializing verification...' });

    try {
      setVerifyState({ status: 'loading', step: 'Verifying attestations...' });
      const results = await verifyReceipt(receipt);

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

  const handleLoadExample = () => {
    setReceiptJson(EXAMPLE_RECEIPT);
    setVerifyState({ status: 'idle' });
  };

  const handleClear = () => {
    setReceiptJson('');
    setVerifyState({ status: 'idle' });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Input Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label
            htmlFor="receipt-json"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Receipt JSON
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleLoadExample}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              Load Example
            </button>
            <span className="text-zinc-300 dark:text-zinc-600">|</span>
            <button
              onClick={handleClear}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        <textarea
          id="receipt-json"
          value={receiptJson}
          onChange={(e) => {
            setReceiptJson(e.target.value);
            if (verifyState.status === 'error') {
              setVerifyState({ status: 'idle' });
            }
          }}
          placeholder="Paste your receipt JSON here..."
          className="h-64 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
        />
      </div>

      {/* Verify Button */}
      <button
        onClick={handleVerify}
        disabled={!receiptJson.trim() || verifyState.status === 'loading'}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-white font-medium transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {verifyState.status === 'loading' ? (
          <>
            <LoadingSpinner />
            {verifyState.step}
          </>
        ) : (
          'Verify Receipt'
        )}
      </button>

      {/* Results Section */}
      {verifyState.status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
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

function VerificationResults({ results }: { results: AllVerificationResults }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Overall Result */}
      <div
        className={`rounded-lg border p-4 ${
          results.result.valid
            ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
            : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
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
            {results.result.valid ? 'Receipt Verified' : 'Verification Failed'}
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
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            Verification Details
          </h3>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
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
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
        {result.message && (
          <span className="text-xs text-zinc-500 dark:text-zinc-500">
            {result.message}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {result.valid ? (
          <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
            <CheckIcon />
            Valid
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
            <XIcon />
            Invalid
          </span>
        )}
      </div>
    </div>
  );
}

const EXAMPLE_RECEIPT = `{
  "version": "1.0",
  "timestamp": 1770301689302,
  "model": "deepseek-ai/DeepSeek-V3.1",
  "prompt": "Explain blockchain in one sentence",
  "requestHash": "cef14d468d15a5e3e59ef1c31dd62f3d006af275847d49c2ef16472c8df10477",
  "responseHash": "1e4cafe672f453d8cc5eced54a3a35141efab1460b926ff2666514edd273ad51",
  "signature": "0xb50e415a16701a3a3122c5bf111168e1f6e911d5cc3955f5dad2752248214b303ed8636e6ee99ed05c1973cdda9b5f5eaf67dce4380dcaf514821b6cfa5a5b891c",
  "signingAddress": "0x34B7BcB4b2b61FCF9fA14715ba8708AC0dBC8Be5",
  "signingAlgo": "ecdsa",
  "output": "A blockchain is a distributed and immutable digital ledger that securely records transactions in a way that is transparent, verifiable, and resistant to modification.",
  "proofHash": "c780c9346fa70305178d5cce8f220b648cacb5b7ec320581f65fa29e97aa2a27",
  "txHash": "996cEWDMmv1M2sq4XWDgwMvjMHq1TmrDZ5dMic1jAdkx"
}`;

function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
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
