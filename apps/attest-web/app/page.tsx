'use client';

import { ReceiptVerifier } from './components/ReceiptVerifier';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-4xl flex-col gap-8 py-16 px-8 bg-white dark:bg-black">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Receipt Verifier
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Verify on your device the authenticity of AI-generated content
            receipts.
          </p>
        </div>

        {/* Verifier Component */}
        <ReceiptVerifier />
      </main>
    </div>
  );
}
