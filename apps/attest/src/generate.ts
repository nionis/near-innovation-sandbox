import type { Receipt, GenerateOptions, ChatMessage } from './types.js';
import type { NearAIProvider } from '@repo/packages-near-ai-provider/types';
import fs from 'fs';
import { generateText } from 'ai';
import { createNearAI } from '@repo/packages-near-ai-provider';
import { NEAR_AI_BASE_URL } from '@repo/packages-near';
import { attest } from '@repo/packages-attestations';

/**
 * Generate AI output with verifiable receipt using a provided NearAI provider instance
 */
export async function generateWithAttestation(
  provider: NearAIProvider,
  options: GenerateOptions,
  nearAiApiKey: string
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

  const receipt = await attest(result, {
    baseURL: NEAR_AI_BASE_URL,
    apiKey: nearAiApiKey,
  });

  return receipt;
}

/**
 * Generate AI output with verifiable receipt (creates provider internally)
 * Convenience function that creates the provider from environment variables
 */
export async function generate(
  options: GenerateOptions,
  nearAiApiKey: string
): Promise<Receipt> {
  const provider = createNearAI({ apiKey: nearAiApiKey });
  return generateWithAttestation(provider, options, nearAiApiKey);
}
