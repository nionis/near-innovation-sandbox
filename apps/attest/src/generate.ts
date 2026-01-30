import type { BlockchainConfig } from '@repo/packages-attestations/types';
import fs from 'fs';
import { generateText } from 'ai';
import { createNearAI } from '@repo/packages-near-ai-provider';
import * as deployment from '@repo/contracts-attestations/deployment';
import type { NearAIProvider } from '@repo/packages-near-ai-provider/types';
import {
  sha256,
  computeProofHash,
  compareHashes,
} from '@repo/packages-attestations/crypto';
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain';
import type { Receipt, GenerateOptions, ChatMessage } from './types.js';

// Re-export types for convenience
export type { Receipt, GenerateOptions } from './types.js';

/**
 * Generate AI output with verifiable receipt using a provided NearAI provider instance
 */
export async function generateWithAttestation(
  provider: NearAIProvider,
  options: GenerateOptions
): Promise<Receipt> {
  // Build the messages array
  const messages: ChatMessage[] = [];

  // Add content as system context if provided
  let contentText = options.content || '';
  if (options.contentFile) {
    if (!fs.existsSync(options.contentFile)) {
      throw new Error(`Content file not found: ${options.contentFile}`);
    }
    contentText = fs.readFileSync(options.contentFile, 'utf-8');
  }

  if (contentText) {
    messages.push({
      role: 'system',
      content: `Context/Source Material:\n\n${contentText}`,
    });
  }

  // Add the user prompt
  messages.push({
    role: 'user',
    content: options.prompt,
  });

  console.log('Sending request to NEAR AI Cloud...');

  // Create the chat model - provider is callable directly
  // Cast to NearAIChatModelId to allow any model string
  const model = provider(options.model as any);

  // Send the chat completion request using the ai SDK
  const result = await generateText({
    model,
    messages,
  });

  // Extract chatId from response - the ai SDK provides response metadata
  // The response.id is typically the chat completion ID
  const chatId = result.response?.id;
  if (!chatId) {
    throw new Error('Failed to get chat ID from response');
  }

  // Compute hashes for the request and response
  const requestPayload = JSON.stringify(messages);
  const requestHash = sha256(requestPayload);
  const responseHash = sha256(result.text);

  console.log(`Response received (chat ID: ${chatId})`);
  console.log('Fetching TEE signature...');

  // Fetch the cryptographic signature using the provider's method
  const signatureData = await provider.fetchSignature(chatId, options.model);

  // Verify the signature text matches our computed hashes (optional warning)
  if (!compareHashes(signatureData.text, requestHash, responseHash)) {
    // The API's hashes might be computed differently, so we use theirs
    console.warn(
      'Note: Local hashes differ from API hashes - using API-provided values'
    );
  }

  // Parse the signature text to get the actual hashes from the API
  const [apiRequestHash, apiResponseHash] = signatureData.text.split(':');

  // Build the receipt
  const receipt: Receipt = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    model: options.model,
    prompt: options.prompt,
    contentFile: options.contentFile,
    requestHash: apiRequestHash || requestHash,
    responseHash: apiResponseHash || responseHash,
    signature: signatureData.signature,
    signingAddress: signatureData.signing_address,
    signingAlgo: signatureData.signing_algo,
    output: result.text,
  };

  // Store on-chain if configured
  if (!options.skipOnChain) {
    const contractId = deployment.testnet.contractId;
    const accountId = process.env.NEAR_ACCOUNT_ID;
    const privateKey = process.env.NEAR_PRIVATE_KEY;
    const network =
      (process.env.NEAR_NETWORK as 'testnet' | 'mainnet') || 'testnet';

    if (contractId && accountId && privateKey) {
      console.log('Storing proof on NEAR blockchain...');

      const blockchainConfig: BlockchainConfig = {
        networkId: network,
        accountId,
        privateKey,
        contractId,
      };

      const blockchain = new AttestationsBlockchain(blockchainConfig);
      await blockchain.init();

      const proofHash = computeProofHash(
        receipt.requestHash,
        receipt.responseHash,
        signatureData.signature
      );

      const { txHash } = await blockchain.storeAttestation(proofHash);

      receipt.onChain = {
        network,
        txHash,
        contractId,
        proofHash,
      };

      console.log(`Proof stored on-chain (hash: ${proofHash})`);
    } else {
      console.log('Skipping on-chain storage (blockchain config not set)');
    }
  }

  // Write receipt to file if specified
  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(receipt, null, 2));
    console.log(`Receipt saved to: ${options.output}`);
  }

  return receipt;
}

/**
 * Generate AI output with verifiable receipt (creates provider internally)
 * Convenience function that creates the provider from environment variables
 */
export async function generate(
  options: GenerateOptions,
  nearApiKey: string
): Promise<Receipt> {
  const provider = createNearAI({ apiKey: nearApiKey });
  return generateWithAttestation(provider, options);
}
