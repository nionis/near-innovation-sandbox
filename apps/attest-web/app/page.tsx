'use client';

import { ChatVerifier } from './components/ChatVerifier';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import {
  downloadBinary,
  decryptString,
  SHARE_API_URL,
} from '@repo/packages-utils/share';

/**
 * Normalize decrypted data to ChatExport format
 * Handles two formats:
 * 1. CLI style: Direct ChatExport object
 * 2. App style: { chatData, receipt, timestamp, version }
 *
 * For app style, merges fields from both chatData and receipt to ensure
 * all data is preserved (chatData contains requestBody, responseBody, output,
 * while receipt contains blockchain-related fields)
 */
function normalizeDecryptedData(decryptedJson: string): string {
  try {
    const parsed = JSON.parse(decryptedJson);

    // Check if it's app style (has chatData and receipt fields)
    if (parsed.receipt && parsed.chatData) {
      // App style - merge all fields from both chatData and receipt
      const normalized = {
        ...parsed.receipt,
        // Ensure we include fields from chatData that might not be in receipt
        requestBody: parsed.chatData.requestBody ?? parsed.receipt.requestBody,
        responseBody:
          parsed.chatData.responseBody ?? parsed.receipt.responseBody,
        ourPassphrase:
          parsed.chatData.ourPassphrase ?? parsed.receipt.ourPassphrase,
        modelsPublicKey:
          parsed.chatData.modelsPublicKey ?? parsed.receipt.modelsPublicKey,
        ephemeralPrivateKeys:
          parsed.chatData.ephemeralPrivateKeys ??
          parsed.receipt.ephemeralPrivateKeys,
        // Include output if it exists (app-specific field)
        ...(parsed.chatData.output && { output: parsed.chatData.output }),
        version: parsed.version,
        timestamp: parsed.timestamp,
        model: JSON.parse(parsed.chatData.requestBody).model,
      };
      return JSON.stringify(normalized, null, 2);
    }

    // Check if it's CLI style (has signature, model, etc.)
    if (parsed.signature && parsed.model) {
      // CLI style - already in correct format, just pretty-print
      return JSON.stringify(parsed, null, 2);
    }

    // Unknown format, return as-is
    return decryptedJson;
  } catch (error) {
    // Invalid JSON, return as-is
    return decryptedJson;
  }
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [loadState, setLoadState] = useState<
    | { status: 'idle' }
    | { status: 'loading'; step: string }
    | { status: 'need_passphrase'; encryptedData: Uint8Array }
    | { status: 'success'; decryptedJson: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const [passphraseInput, setPassphraseInput] = useState('');

  useEffect(() => {
    const id = searchParams.get('id');
    const passphrase = searchParams.get('passphrase');

    if (!id) {
      // No id parameter, show normal interface
      setLoadState({ status: 'idle' });
      return;
    }

    // Start download process
    const downloadAndDecrypt = async () => {
      try {
        setLoadState({
          status: 'loading',
          step: 'Downloading encrypted data...',
        });
        const encryptedData = await downloadBinary(SHARE_API_URL, id);

        if (!passphrase) {
          // Need passphrase input
          setLoadState({ status: 'need_passphrase', encryptedData });
          return;
        }

        // Decrypt with passphrase
        setLoadState({ status: 'loading', step: 'Decrypting data...' });
        const passphraseWords = passphrase.split('-');
        const decryptedString = decryptString(encryptedData, passphraseWords);

        // Normalize the format
        const normalizedJson = normalizeDecryptedData(decryptedString);

        console.log('normalizedJson', normalizedJson);

        setLoadState({ status: 'success', decryptedJson: normalizedJson });
      } catch (error) {
        console.error('Failed to download/decrypt:', error);
        setLoadState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to download or decrypt data',
        });
      }
    };

    downloadAndDecrypt();
  }, [searchParams]);

  const handlePassphraseSubmit = async () => {
    if (loadState.status !== 'need_passphrase' || !passphraseInput.trim()) {
      return;
    }

    try {
      setLoadState({ status: 'loading', step: 'Decrypting data...' });
      const passphraseWords = passphraseInput.trim().split('-');
      const decryptedString = decryptString(
        loadState.encryptedData,
        passphraseWords
      );

      // Normalize the format
      const normalizedJson = normalizeDecryptedData(decryptedString);

      setLoadState({ status: 'success', decryptedJson: normalizedJson });
    } catch (error) {
      console.error('Decryption failed:', error);
      setLoadState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to decrypt. Please check your passphrase.',
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 font-sans dark:from-[oklch(0.15_0.03_285)] dark:via-[oklch(0.18_0.05_285)] dark:to-[oklch(0.16_0.04_300)]">
      <main className="flex min-h-screen w-full max-w-4xl flex-col gap-8 py-16 px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl blur-xl opacity-20 dark:opacity-40"></div>
            <img 
              src="/logo.png" 
              alt="AttestAI Logo" 
              className="relative h-20 w-20 rounded-2xl shadow-lg"
            />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-purple-600 to-violet-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-violet-400">
              AttestAI Verifier
            </h1>
            <p className="text-purple-700 dark:text-purple-300 text-lg">
              Verify on your device the authenticity of AI-generated content.
            </p>
          </div>
        </div>

        {/* App Download Banner */}
        <div className="rounded-xl border border-purple-300 bg-gradient-to-br from-purple-100 to-violet-100 p-4 shadow-lg dark:border-purple-700/50 dark:from-[oklch(0.22_0.06_285)] dark:to-[oklch(0.24_0.07_300)]">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <DownloadIcon />
            </div>
            <div className="flex-1">
              <p className="text-sm text-purple-900 dark:text-purple-100">
                <span className="font-semibold">Want more advanced functionality?</span> Download the desktop app for the complete AttestAI experience.
              </p>
            </div>
            <a
              href="https://github.com/nionis/near-innovation-sandbox/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 rounded-lg bg-gradient-to-br from-purple-600 to-violet-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-purple-700 hover:to-violet-700 shadow-md hover:shadow-lg"
            >
              Download
            </a>
          </div>
        </div>

        {/* Loading State */}
        {loadState.status === 'loading' && (
          <div className="rounded-xl border border-purple-200 bg-white/80 backdrop-blur-sm p-8 shadow-lg dark:border-purple-800/50 dark:bg-[oklch(0.2_0.04_285)]/80">
            <div className="flex items-center justify-center gap-3">
              <LoadingSpinner />
              <span className="text-purple-700 dark:text-purple-300">
                {loadState.step}
              </span>
            </div>
          </div>
        )}

        {/* Passphrase Input */}
        {loadState.status === 'need_passphrase' && (
          <div className="rounded-xl border border-purple-200 bg-white/80 backdrop-blur-sm p-6 shadow-lg dark:border-purple-800/50 dark:bg-[oklch(0.2_0.04_285)]/80">
            <div className="flex items-center gap-2 mb-2">
              <KeyIcon />
              <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                Enter Passphrase
              </h2>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
              This receipt is encrypted. Please enter the passphrase to decrypt
              it.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePassphraseSubmit();
                  }
                }}
                placeholder="word1-word2-word3-word4-word5-word6"
                className="flex-1 rounded-lg border border-purple-200 bg-white px-4 py-2 text-sm text-purple-900 placeholder:text-purple-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-purple-700 dark:bg-[oklch(0.28_0.05_285)] dark:text-purple-100 dark:placeholder:text-purple-500 dark:focus:border-purple-600 dark:focus:ring-purple-700"
              />
              <button
                onClick={handlePassphraseSubmit}
                disabled={!passphraseInput.trim()}
                className="rounded-lg bg-gradient-to-br from-purple-600 to-violet-600 px-6 py-2 text-sm font-medium text-white transition-all hover:from-purple-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                Decrypt
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {loadState.status === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50/80 backdrop-blur-sm p-4 shadow-lg dark:border-red-900/50 dark:bg-red-950/80">
            <div className="flex items-center gap-2">
              <ErrorIcon />
              <span className="font-medium text-red-800 dark:text-red-200">
                Error
              </span>
            </div>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">
              {loadState.message}
            </p>
          </div>
        )}

        {/* Verifier Component */}
        {(loadState.status === 'idle' || loadState.status === 'success') && (
          <ChatVerifier
            initialJson={
              loadState.status === 'success'
                ? loadState.decryptedJson
                : undefined
            }
          />
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 font-sans dark:from-[oklch(0.15_0.03_285)] dark:via-[oklch(0.18_0.05_285)] dark:to-[oklch(0.16_0.04_300)]">
      <LoadingSpinner />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400"
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

function KeyIcon() {
  return (
    <svg
      className="h-5 w-5 text-purple-600 dark:text-purple-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-6 w-6 text-purple-600 dark:text-purple-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}
