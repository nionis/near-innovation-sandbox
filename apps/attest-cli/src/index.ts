#!/usr/bin/env node

import type { ModelMessage } from 'ai';
import pkg from '../package.json' with { type: 'json' };
import {
  createNearAI,
  getE2EECapturePromise,
  clearE2EECapture,
  fetchAvailableModels,
} from '@repo/packages-near-ai-provider';
import {
  NearBlockchainNetwork,
  type NearAIChatModelId,
} from '@repo/packages-utils/near';
import * as SMART_CONTRACTS from '@repo/contracts-attestations/deployment';
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain';
import {
  type Receipt,
  type VerificationResult,
  attest,
  storeAttestationRecordWithBlockchain,
  verify,
} from '@repo/packages-attestations';
import { generateText } from 'ai';
import { Command } from 'commander';
import dotenv from 'dotenv';
import fs from 'fs';

// load environment variables
dotenv.config();

// ASCII art banner for NEARCON Innovation Sandbox
const banner = `
\x1b[36m╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   \x1b[33m███╗   ██╗███████╗ █████╗ ██████╗  \x1b[35m █████╗ ██╗\x1b[36m                   ║
║   \x1b[33m████╗  ██║██╔════╝██╔══██╗██╔══██╗ \x1b[35m██╔══██╗██║\x1b[36m                   ║
║   \x1b[33m██╔██╗ ██║█████╗  ███████║██████╔╝ \x1b[35m███████║██║\x1b[36m                   ║
║   \x1b[33m██║╚██╗██║██╔══╝  ██╔══██║██╔══██╗ \x1b[35m██╔══██║██║\x1b[36m                   ║
║   \x1b[33m██║ ╚████║███████╗██║  ██║██║  ██║ \x1b[35m██║  ██║██║\x1b[36m                   ║
║   \x1b[33m╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ \x1b[35m╚═╝  ╚═╝╚═╝\x1b[36m                   ║
║                                                                   ║
║   \x1b[32m┌─────────────────────────────────────────────────────────┐\x1b[36m     ║
║   \x1b[32m│\x1b[0m  🔐 \x1b[1mInnovation Sandbox\x1b[0m - Verifiable AI Attestations      \x1b[32m│\x1b[36m     ║
║   \x1b[32m│\x1b[0m  🌐 TEE-secured • Blockchain-verified • Trustworthy    \x1b[32m│\x1b[36m     ║
║   \x1b[32m└─────────────────────────────────────────────────────────┘\x1b[36m     ║
║                                                                   ║
║   \x1b[90m⬡ ─── ⬡ ─── ⬡ ─── ⬡ ─── ⬡ ─── ⬡ ─── ⬡ ─── ⬡ ─── ⬡ ─── ⬡\x1b[36m     ║
║   \x1b[90m        NEARCON Hackathon • near-innovation-sandbox\x1b[36m          ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝\x1b[0m
`;

console.log(banner);

const NEAR_NETWORK: NearBlockchainNetwork = 'testnet';

const program = new Command();
program.name('attest').description(pkg.description).version(pkg.version);

// generate command
program
  .command('generate')
  .description('Generate AI output with a verifiable receipt')
  .requiredOption(
    '-m, --model <model>',
    'Model to use (e.g., deepseek-ai/DeepSeek-V3.1)'
  )
  .requiredOption('-p, --prompt <prompt>', 'Prompt to send to the model')
  .option(
    '--api-key <key>',
    'NEAR AI API key (defaults to NEAR_AI_API_KEY env var)',
    process.env.NEAR_AI_API_KEY
  )
  .option(
    '--account-id <id>',
    'NEAR account ID (defaults to NEAR_ACCOUNT_ID env var)',
    process.env.NEAR_ACCOUNT_ID
  )
  .option(
    '--private-key <key>',
    'NEAR private key (defaults to NEAR_PRIVATE_KEY env var)',
    process.env.NEAR_PRIVATE_KEY
  )
  .option('--disable-e2ee', 'Disable E2EE (defaults to false)')
  .option(
    '-o, --output <path>',
    'Output file for the receipt (default: prints to stdout)'
  )
  .action(async (options) => {
    try {
      // --disable-e2ee flag takes precedence, then env var, then default to false
      const disableE2ee =
        options.disableE2ee ?? process.env.DISABLE_E2EE === 'true';

      const nearAiApiKey = options.apiKey;
      if (!nearAiApiKey) {
        console.error(
          'NEAR_AI_API_KEY is required. Provide via --api-key or NEAR_AI_API_KEY env var'
        );
        process.exit(1);
      }
      const nearAccountId = options.accountId;
      if (!nearAccountId) {
        console.error(
          'NEAR_ACCOUNT_ID is required. Provide via --account-id or NEAR_ACCOUNT_ID env var'
        );
        process.exit(1);
      }
      const nearPrivateKey = options.privateKey;
      if (!nearPrivateKey) {
        console.error(
          'NEAR_PRIVATE_KEY is required. Provide via --private-key or NEAR_PRIVATE_KEY env var'
        );
        process.exit(1);
      }

      const provider = createNearAI({
        apiKey: nearAiApiKey,
        e2ee: { enabled: !disableE2ee },
      });

      const blockchain = new AttestationsBlockchain({
        networkId: NEAR_NETWORK,
        contractId: SMART_CONTRACTS.testnet.contractId,
        accountId: nearAccountId,
        privateKey: nearPrivateKey,
      });

      const messages: ModelMessage[] = [];
      messages.push({
        role: 'user',
        content: options.prompt,
      });

      console.log('Generating AI output...');
      console.log(`  E2EE: ${!disableE2ee}`);
      console.log(`  Model: ${options.model}`);
      console.log(`  Prompt: ${options.prompt}`);

      // Clear any previous E2EE capture
      clearE2EECapture();

      const model = provider(options.model as NearAIChatModelId);
      const result = await generateText({
        model,
        messages,
      });

      // Get captured E2EE data (encrypted request/response for attestation)
      const capturedData = await getE2EECapturePromise();

      // console.log('capturedData', capturedData);
      // console.log('requestBody', typeof result.request.body);
      // console.log('responseBody', typeof result.response.body);

      console.log('Attesting AI output...');
      const receipt = await attest(
        {
          id: capturedData?.id ?? result.response.id,
          requestBody: capturedData?.requestBody ?? String(result.request.body),
          responseBody:
            capturedData?.responseBody ?? JSON.stringify(result.response.body),
          output: result.text,
        },
        nearAiApiKey
      );

      console.log('Storing attestation record on blockchain...');
      const { txHash } = await storeAttestationRecordWithBlockchain(
        blockchain,
        { proofHash: receipt.proofHash, timestamp: receipt.timestamp }
      );
      receipt.txHash = txHash;

      if (options.output) {
        console.log(`Writing receipt to ${options.output}`);
        fs.writeFileSync(options.output, JSON.stringify(receipt, null, 2));
      }
      console.log('Receipt');
      console.log(`  Signature: ${receipt.signature}`);
      console.log(receipt.output);
    } catch (error) {
      console.error(error);
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// verify command
program
  .command('verify')
  .description('Verify a receipt against TEE attestation and blockchain')
  .requiredOption('-r, --receipt <path>', 'Path to the receipt JSON file')
  .action(async (options) => {
    try {
      const receipt = JSON.parse(
        fs.readFileSync(options.receipt, 'utf-8')
      ) as Receipt;

      const blockchain = new AttestationsBlockchain({
        networkId: NEAR_NETWORK,
        contractId: SMART_CONTRACTS.testnet.contractId,
      });

      const {
        result,
        chat,
        model_gpu,
        model_tdx,
        model_compose,
        gateway_tdx,
        gateway_compose,
        notorized,
      } = await verify(receipt, blockchain);

      function printVerificationResult(
        name: string,
        result: VerificationResult
      ) {
        console.log(
          `${name}:`,
          result.valid ? '✅' : '❌ ' + (result.message ?? 'unknown error')
        );
      }

      console.log('Verifying AI output...');
      printVerificationResult('chat', chat);
      printVerificationResult('model_gpu', model_gpu);
      printVerificationResult('model_tdx', model_tdx);
      printVerificationResult('model_compose', model_compose);
      printVerificationResult('gateway_tdx', gateway_tdx);
      printVerificationResult('gateway_compose', gateway_compose);
      printVerificationResult('notorized', notorized);

      if (result.valid) {
        console.log('Verified AI output!');
        console.log(`  Model: ${receipt.model}`);
        console.log(`  Prompt: ${receipt.prompt}`);
        console.log(`  Output: ${receipt.output}`);
      } else {
        console.log('Verification failed!');
        console.log(`  Reason: ${result.message}`);
      }

      process.exit(result.valid ? 0 : 1);
    } catch (error) {
      console.error(error);
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// models command
program
  .command('list-models')
  .description('List available models')
  .option(
    '--api-key <key>',
    'NEAR AI API key (defaults to NEAR_AI_API_KEY env var)',
    process.env.NEAR_AI_API_KEY
  )
  .action(async (options) => {
    const nearAiApiKey = options.apiKey;
    if (!nearAiApiKey) {
      console.error(
        'NEAR_AI_API_KEY is required. Provide via --api-key or NEAR_AI_API_KEY env var'
      );
      process.exit(1);
    }

    try {
      const response = await fetchAvailableModels(nearAiApiKey);
      for (const model of response.data) {
        console.log(`- ${model.id} (${model.owned_by})`);
      }
      process.exit(0);
    } catch (error) {
      console.error(error);
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
