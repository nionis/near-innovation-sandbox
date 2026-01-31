#!/usr/bin/env node

import type { ModelMessage } from 'ai';
import pkg from '../package.json' with { type: 'json' };
import { createNearAI } from '@repo/packages-near-ai-provider';
import { type NearAIChatModelId, NEAR_AI_BASE_URL } from '@repo/packages-near';
import {
  type Receipt,
  type VerificationResult,
  attest,
  verify,
} from '@repo/packages-attestations';
import { generateText } from 'ai';
import { Command } from 'commander';
import dotenv from 'dotenv';
import fs from 'fs';

// load environment variables
dotenv.config();

const NEAR_AI_API_KEY = process.env.NEAR_AI_API_KEY;
if (!NEAR_AI_API_KEY) {
  console.error('NEAR_AI_API_KEY is not set');
  process.exit(1);
}

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
    '-o, --output <path>',
    'Output file for the receipt (default: prints to stdout)'
  )
  .action(async (options) => {
    try {
      const provider = createNearAI({ apiKey: NEAR_AI_API_KEY });
      const messages: ModelMessage[] = [];
      messages.push({
        role: 'user',
        content: options.prompt,
      });

      console.log('Generating AI output...');
      console.log(`  Model: ${options.model}`);
      console.log(`  Prompt: ${options.prompt}`);
      const model = provider(options.model as NearAIChatModelId);
      const result = await generateText({
        model,
        messages,
      });

      console.log('Attesting AI output...');
      const receipt = await attest(result, NEAR_AI_API_KEY);

      if (options.output) {
        console.log(`Writing receipt to ${options.output}`);
        fs.writeFileSync(options.output, JSON.stringify(receipt, null, 2));
      }
      console.log('Receipt');
      console.log(`  Signature: ${receipt.signature}`);
      console.log(receipt.output);
    } catch (error) {
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
    const receipt = JSON.parse(
      fs.readFileSync(options.receipt, 'utf-8')
    ) as Receipt;

    try {
      const {
        result,
        chat,
        model_gpu,
        model_tdx,
        model_compose,
        gateway_tdx,
        gateway_compose,
      } = await verify(receipt);

      function printVerificationResult(
        name: string,
        result: VerificationResult
      ) {
        console.log(
          `${name}:`,
          result.valid ? '✅' : '❌ ' + (result.message ?? 'unknown error')
        );
      }
      printVerificationResult('chat', chat);
      printVerificationResult('model_gpu', model_gpu);
      printVerificationResult('model_tdx', model_tdx);
      printVerificationResult('model_compose', model_compose);
      printVerificationResult('gateway_tdx', gateway_tdx);
      printVerificationResult('gateway_compose', gateway_compose);
      process.exit(result.valid ? 0 : 1);
    } catch (error) {
      console.error(error);
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
