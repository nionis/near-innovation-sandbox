#!/usr/bin/env node

import type { ModelMessage } from 'ai';
import pkg from '../package.json' with { type: 'json' };
import {
  createNearAI,
  capturedResponsePromise,
  fetchAvailableModels,
} from '@repo/packages-near-ai-provider';
import {
  NearBlockchainNetwork,
  type NearAIChatModelId,
} from '@repo/packages-utils/near';
import * as SMART_CONTRACTS from '@repo/contracts-attestations/deployment';
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain';
import {
  type ChatExport,
  type VerificationResult,
  attest,
  storeAttestationRecordWithBlockchain,
  verify,
} from '@repo/packages-attestations';
import { computeProofHash } from '@repo/packages-attestations/crypto';
import {
  generateKeyPairFromPassphrase,
  parseRequestBody,
  extractOutputFromResponseBody,
  decryptSSEStream,
} from '@repo/packages-utils/e2ee';
import {
  SHARE_API_URL,
  encryptString,
  decryptString,
  uploadBinary,
  downloadBinary,
} from '@repo/packages-utils/share';
import { streamText } from 'ai';
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
    '--disable-store',
    'Disable upload to share API and record store on blockchain (defaults to false)'
  )
  .option(
    '-e, --export <path>',
    'Export file for the chat (default: prints to stdout)'
  )
  .action(async (options) => {
    try {
      // --disable-e2ee flag takes precedence, then env var, then default to false
      const disableE2ee =
        options.disableE2ee ?? process.env.DISABLE_E2EE === 'true';
      // --disable-upload flag takes precedence, then env var, then default to false
      const disableStore =
        options.disableStore ?? process.env.DISABLE_STORE === 'true';

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
      const shareApiUrl = process.env.SHARE_API_URL ?? SHARE_API_URL;
      if (!shareApiUrl) {
        console.error('env var SHARE_API_URL is required');
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

      const model = provider(options.model as NearAIChatModelId);
      const stream = streamText({
        model,
        messages,
      });

      let output = '';
      for await (const chunk of stream.textStream) {
        console.log('chunk', chunk);
        output += chunk;
      }

      const chatId = (await stream.response).id;
      const captured = await capturedResponsePromise;
      if (!captured) throw new Error('No captured response');

      console.log('Attesting AI output...');
      const chatAttestation = await attest(
        {
          chatId,
          requestBody: captured.requestBody,
          responseBody: captured.responseBody,
        },
        nearAiApiKey
      );

      const proofHash = computeProofHash(
        chatAttestation.requestHash,
        chatAttestation.responseHash,
        chatAttestation.signature
      );
      const now = Date.now();

      const chatExport: ChatExport = {
        version: '1.0.0',
        timestamp: now,
        proofHash,
        txHash: '',
        model: options.model,
        requestBody: captured.requestBody,
        responseBody: captured.responseBody,
        signature: chatAttestation.signature,
        signingAddress: chatAttestation.signingAddress,
        signingAlgo: chatAttestation.signingAlgo,
        e2ee: captured.e2ee,
        modelsPublicKey: captured.e2ee ? captured.modelsPublicKey : undefined,
        ephemeralPrivateKeys: captured.e2ee
          ? captured.ephemeralPrivateKeys
          : undefined,
        ourPassphrase: captured.ourPassphrase,
      } as ChatExport;

      let txHash = '';
      if (!disableStore) {
        console.log('Storing attestation record on blockchain...');
        txHash = (
          await storeAttestationRecordWithBlockchain(blockchain, {
            proofHash,
            timestamp: now,
          })
        ).txHash;
        const encryptedBinary = encryptString(
          JSON.stringify(chatExport),
          chatExport.ourPassphrase
        );
        const { id: shareId } = await uploadBinary(shareApiUrl, {
          requestHash: chatAttestation.requestHash,
          responseHash: chatAttestation.responseHash,
          signature: chatAttestation.signature,
          binary: encryptedBinary,
        });
        if (shareId !== proofHash) {
          console.error('Share ID mismatch');
          console.error(`  Share ID: ${shareId}`);
          console.error(`  Proof Hash: ${proofHash}`);
          process.exit(1);
        }
        console.log(`Shared chat export with id: ${shareId}`);
      }
      chatExport.txHash = txHash;

      if (options.export) {
        console.log(`Exporting chat to ${options.export}`);
        fs.writeFileSync(options.export, JSON.stringify(chatExport, null, 2));
      }
      console.log('Result:');
      console.log(`  Signature: ${chatAttestation.signature}`);
      console.log(`  Proof Hash: ${proofHash}`);

      console.log('output', output);
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
  .requiredOption('-i, --import <path>', 'Path to the import JSON file')
  .action(async (options) => {
    try {
      const chatExport = JSON.parse(
        fs.readFileSync(options.import, 'utf-8')
      ) as ChatExport;

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
      } = await verify(chatExport, blockchain);

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

      const { messages } = parseRequestBody(chatExport.requestBody);
      const prompt = messages[messages.length - 1]!.content;

      if (result.valid) {
        console.log('Verified AI output!');
        console.log(`  Model: ${chatExport.model}`);
        console.log(`  Prompt: ${prompt}`);
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

// show command
program
  .command('show')
  .description('Show a chat export')
  .requiredOption('-i, --import <path>', 'Path to the import JSON file')
  .action(async (options) => {
    try {
      const chatExport = JSON.parse(
        fs.readFileSync(options.import, 'utf-8')
      ) as ChatExport;

      let output = '';

      if (chatExport.e2ee) {
        const ourKeyPair = generateKeyPairFromPassphrase(
          chatExport.ourPassphrase
        );
        output = decryptSSEStream(ourKeyPair, chatExport.responseBody).content;
      } else {
        output = extractOutputFromResponseBody(chatExport.responseBody);
      }

      console.log('Output:', output);
    } catch (error) {
      console.error(error);
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// verify command
program
  .command('download')
  .description('Download a chat export from the share API')
  .requiredOption('-i, --id <id>', 'Share ID')
  .requiredOption('-p, --passphrase <passphrase>', 'Passphrase')
  .action(async (options) => {
    try {
      const shareApiUrl = process.env.SHARE_API_URL ?? SHARE_API_URL;
      if (!shareApiUrl) {
        console.error('env var SHARE_API_URL is required');
        process.exit(1);
      }

      const passphrase = options.passphrase.split('-') as string[];
      console.log('Downloading chat export from share API...');
      console.log(`  Share ID: ${options.id}`);
      console.log(`  Passphrase: ${options.passphrase}`);
      const binary = await downloadBinary(shareApiUrl, options.id);

      console.log('Decrypting chat export...');
      const chatExport = JSON.parse(
        decryptString(binary, passphrase)
      ) as ChatExport;

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
      } = await verify(chatExport, blockchain);

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

      const { messages } = parseRequestBody(chatExport.requestBody);
      const prompt = messages[messages.length - 1]!.content;

      if (result.valid) {
        console.log('Verified AI output!');
        console.log(`  Model: ${chatExport.model}`);
        console.log(`  Prompt: ${prompt}`);
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
      const models = await fetchAvailableModels(nearAiApiKey);
      console.log('Available NEAR AI E2EE models:');
      for (const modelId of models) {
        console.log(`- ${modelId}`);
      }
      process.exit(0);
    } catch (error) {
      console.error(error);
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
