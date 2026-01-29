import fs from 'fs';
import { generateText } from 'ai';
import { nearai } from '@repo/packages-near-ai-provider';
import { computeProofHash, compareHashes } from './crypto.js';
import { initNear, storeProofOnChain, BlockchainConfig } from './blockchain.js';

const provider = nearai('deepseek-ai/DeepSeek-V3.1');

export interface Receipt {
  version: string;
  timestamp: string;
  model: string;
  prompt: string;
  contentFile?: string;
  requestHash: string;
  responseHash: string;
  signature: string;
  signingAddress: string;
  signingAlgo: string;
  output: string;
  onChain?: {
    network: string;
    txHash: string;
    contractId: string;
    proofHash: string;
  };
}

export interface GenerateOptions {
  model: string;
  prompt: string;
  content?: string;
  contentFile?: string;
  output?: string;
  skipOnChain?: boolean;
}

/**
 * Generate AI output with verifiable receipt
 */
export async function generate(options: GenerateOptions): Promise<Receipt> {
  const apiKey = process.env.NEARAI_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('NEARAI_CLOUD_API_KEY environment variable not set');
  }

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

  // Send the chat completion request
  const result = await sendChatCompletion(apiKey, options.model, messages);

  console.log(`Response received (chat ID: ${result.chatId})`);
  console.log('Fetching TEE signature...');

  // Fetch the cryptographic signature
  const signatureData = await fetchSignature(
    apiKey,
    result.chatId,
    result.model
  );

  // Verify the signature text matches our computed hashes
  if (
    !compareHashes(signatureData.text, result.requestHash, result.responseHash)
  ) {
    console.warn('Warning: Signature text does not match computed hashes');
  }

  // Build the receipt
  const receipt: Receipt = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    model: options.model,
    prompt: options.prompt,
    contentFile: options.contentFile,
    requestHash: result.requestHash,
    responseHash: result.responseHash,
    signature: signatureData.signature,
    signingAddress: signatureData.signing_address,
    signingAlgo: signatureData.signing_algo,
    output: result.output,
  };

  // Store on-chain if configured
  if (!options.skipOnChain) {
    const contractId = process.env.PROOF_CONTRACT_ID;
    const accountId = process.env.NEAR_ACCOUNT_ID;
    const privateKey = process.env.NEAR_PRIVATE_KEY;
    const network = process.env.NEAR_NETWORK || 'testnet';

    if (contractId && accountId && privateKey) {
      console.log('Storing proof on NEAR blockchain...');

      const blockchainConfig: BlockchainConfig = {
        networkId: network,
        accountId,
        privateKey,
        contractId,
      };

      await initNear(blockchainConfig);

      const proofHash = computeProofHash(
        result.requestHash,
        result.responseHash,
        signatureData.signature
      );

      const { txHash } = await storeProofOnChain(contractId, proofHash);

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
