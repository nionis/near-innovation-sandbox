'use client';

import { useState, useCallback } from 'react';
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
}

export function ChatVerifier({ onVerificationComplete }: ChatVerifierProps) {
  const [chatExportJson, setChatExportJson] = useState('');
  const [verifyState, setVerifyState] = useState<VerifyState>({
    status: 'idle',
  });

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
      'version',
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
      setVerifyState({ status: 'loading', step: 'Verifying attestations...' });
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

  const handleLoadExample = () => {
    setChatExportJson(EXAMPLE_CHAT_EXPORT);
    setVerifyState({ status: 'idle' });
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
          value={chatExportJson}
          onChange={(e) => {
            setChatExportJson(e.target.value);
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
        disabled={!chatExportJson.trim() || verifyState.status === 'loading'}
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

function VerificationResults({ results }: { results: VerifyOutput }) {
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

const EXAMPLE_CHAT_EXPORT = `{
  "version": "1.0.0",
  "timestamp": 1770459386903,
  "txHash": "FhWiwPpDjSgkuV6i6Bc35ZV48h5gp5yzs5dKVzuovQTj",
  "model": "deepseek-ai/DeepSeek-V3.1",
  "requestBody": "{\"model\":\"deepseek-ai/DeepSeek-V3.1\",\"messages\":[{\"role\":\"user\",\"content\":\"Explain blockchain in one sentence\"}],\"stream\":true}",
  "responseBody": "data: {\"id\":\"chatcmpl-8687bbd89685b81e\",\"object\":\"chat.completion.chunk\",\"created\":1770459385,\"model\":\"deepseek-ai/DeepSeek-V3.1\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"\",\"reasoning_content\":null},\"logprobs\":null,\"finish_reason\":null}],\"usage\":{\"prompt_tokens\":12,\"total_tokens\":12,\"completion_tokens\":0},\"prompt_token_ids\":null}\n\ndata: {\"id\":\"chatcmpl-8687bbd89685b81e\",\"object\":\"chat.completion.chunk\",\"created\":1770459385,\"model\":\"deepseek-ai/DeepSeek-V3.1\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"A\",\"reasoning_content\":null},\"logprobs\":null,\"finish_reason\":null,\"token_ids\":null}],\"usage\":{\"prompt_tokens\":12,\"total_tokens\":13,\"completion_tokens\":1}}\n\ndata: {\"id\":\"chatcmpl-8687bbd89685b81e\",\"object\":\"chat.completion.chunk\",\"created\":1770459385,\"model\":\"deepseek-ai/DeepSeek-V3.1\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\" blockchain is a decentralized, immutable\",\"reasoning_content\":null},\"logprobs\":null,\"finish_reason\":null,\"token_ids\":null}],\"usage\":{\"prompt_tokens\":12,\"total_tokens\":19,\"completion_tokens\":7}}\n\ndata: {\"id\":\"chatcmpl-8687bbd89685b81e\",\"object\":\"chat.completion.chunk\",\"created\":1770459385,\"model\":\"deepseek-ai/DeepSeek-V3.1\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\" digital ledger that securely records transactions\",\"reasoning_content\":null},\"logprobs\":null,\"finish_reason\":null,\"token_ids\":null}],\"usage\":{\"prompt_tokens\":12,\"total_tokens\":25,\"completion_tokens\":13}}\n\ndata: {\"id\":\"chatcmpl-8687bbd89685b81e\",\"object\":\"chat.completion.chunk\",\"created\":1770459385,\"model\":\"deepseek-ai/DeepSeek-V3.1\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\" across a distributed network of computers.\",\"reasoning_content\":null},\"logprobs\":null,\"finish_reason\":null,\"token_ids\":null}],\"usage\":{\"prompt_tokens\":12,\"total_tokens\":32,\"completion_tokens\":20}}\n\ndata: {\"id\":\"chatcmpl-8687bbd89685b81e\",\"object\":\"chat.completion.chunk\",\"created\":1770459385,\"model\":\"deepseek-ai/DeepSeek-V3.1\",\"choices\":[{\"index\":0,\"delta\":{\"reasoning_content\":null},\"logprobs\":null,\"finish_reason\":\"stop\",\"stop_reason\":null,\"token_ids\":null}],\"usage\":{\"prompt_tokens\":12,\"total_tokens\":33,\"completion_tokens\":21}}\n\ndata: {\"id\":\"chatcmpl-8687bbd89685b81e\",\"object\":\"chat.completion.chunk\",\"created\":1770459385,\"model\":\"deepseek-ai/DeepSeek-V3.1\",\"choices\":[],\"usage\":{\"prompt_tokens\":12,\"total_tokens\":33,\"completion_tokens\":21}}\n\ndata: [DONE]\n\n",
  "signature": "0xf34e2abc9f19073e43a425f5a0bf68b8af56379214b8a270fe634938a0f8f8424b42dbb7eaba77ff44963e8bd3072c8337df989a22ab4c1bdafc2eeb9c52d21e1c",
  "signingAddress": "0x34B7BcB4b2b61FCF9fA14715ba8708AC0dBC8Be5",
  "signingAlgo": "ecdsa",
  "e2ee": false
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
