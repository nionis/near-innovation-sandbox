#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { generate } from './generate.js';
import { verify } from './verify.js';
import pkg from '../package.json' with { type: 'json' };

// load environment variables
dotenv.config();

const nearApiKey = process.env.NEAR_API_KEY;
if (!nearApiKey) {
  console.error('NEAR_API_KEY is not set');
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
  .option('-c, --content <text>', 'Content/context to include with the prompt')
  .option('-f, --content-file <path>', 'File containing content/context')
  .option(
    '-o, --output <path>',
    'Output file for the receipt (default: prints to stdout)'
  )
  .option('--skip-on-chain', 'Skip storing proof on NEAR blockchain')
  .action(async (options) => {
    try {
      const receipt = await generate(
        {
          model: options.model,
          prompt: options.prompt,
          content: options.content,
          contentFile: options.contentFile,
          output: options.output,
          skipOnChain: options.skipOnChain,
        },
        nearApiKey
      );

      if (!options.output) {
        console.log('\n--- Receipt ---');
        console.log(JSON.stringify(receipt, null, 2));
      }

      console.log('\n--- AI Output ---');
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
  .option('--skip-on-chain', 'Skip on-chain verification')
  .action(async (options) => {
    try {
      const result = await verify({
        receiptFile: options.receipt,
        skipOnChain: options.skipOnChain,
      });

      process.exit(result.valid ? 0 : 1);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
