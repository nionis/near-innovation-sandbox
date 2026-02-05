/**
 * E2EE Fetch Middleware
 *
 * Wraps the fetch function to handle end-to-end encryption for NEAR AI chat completions.
 * - Encrypts message content in requests
 * - Adds required E2EE headers
 * - Decrypts content in streaming responses
 * - Captures encrypted wire content for attestation
 */

import type { E2EEContext, E2EECapturedData } from './types.js';
import { generatePassphrase } from '../passphrase.js';
import { generateKeyPair, eciesEncrypt, eciesDecrypt } from './crypto.js';
import { bytesToHex } from '@noble/ciphers/utils.js';

/** Promise that resolves when capture is complete */
let capturePromise: Promise<E2EECapturedData | null> | null = null;

/**
 * Get the promise for captured E2EE data
 * Call this after making a request and await to get the captured encrypted data
 */
export function getE2EECapturePromise(): Promise<E2EECapturedData | null> {
  if (!capturePromise) {
    return Promise.resolve(null);
  }
  return capturePromise;
}

/**
 * Clear the E2EE capture state
 */
export function clearE2EECapture(): void {
  capturePromise = null;
}

/** Chat message structure */
interface ChatMessage {
  role: string;
  content?: string;
  [key: string]: unknown;
}

/** Chat completion request body */
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}

/**
 * Encrypt message content fields in the request body
 */
function encryptRequestBody(
  body: ChatCompletionRequest,
  modelPublicKey: string
): ChatCompletionRequest {
  const encryptedMessages = body.messages.map((message) => {
    if (typeof message.content === 'string' && message.content.length > 0) {
      return {
        ...message,
        content: eciesEncrypt(message.content, modelPublicKey),
      };
    }
    return message;
  });

  return {
    ...body,
    messages: encryptedMessages,
  };
}

/**
 * Create a TransformStream that decrypts content in SSE chunks
 */
function createDecryptingStream(
  privateKey: string
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });

      // Process complete lines
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            controller.enqueue(encoder.encode(line + '\n'));
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const decrypted = decryptChunk(parsed, privateKey);
            controller.enqueue(
              encoder.encode('data: ' + JSON.stringify(decrypted) + '\n')
            );
          } catch {
            // If parsing fails, pass through unchanged
            controller.enqueue(encoder.encode(line + '\n'));
          }
        } else {
          // Pass through non-data lines (empty lines, comments, etc.)
          controller.enqueue(encoder.encode(line + '\n'));
        }
      }
    },
    flush(controller) {
      // Process any remaining buffer content
      if (buffer.length > 0) {
        controller.enqueue(encoder.encode(buffer));
      }
    },
  });
}

/**
 * Decrypt content fields in a streaming chunk
 */
function decryptChunk(chunk: unknown, privateKey: string): unknown {
  if (!chunk || typeof chunk !== 'object') {
    return chunk;
  }

  const obj = chunk as Record<string, unknown>;

  // Handle chat completion chunk format
  if (Array.isArray(obj.choices)) {
    return {
      ...obj,
      choices: obj.choices.map((choice: unknown) => {
        if (!choice || typeof choice !== 'object') return choice;
        const c = choice as Record<string, unknown>;

        // Handle delta (streaming) format
        if (c.delta && typeof c.delta === 'object') {
          const delta = c.delta as Record<string, unknown>;
          if (typeof delta.content === 'string' && delta.content.length > 0) {
            try {
              return {
                ...c,
                delta: {
                  ...delta,
                  content: eciesDecrypt(delta.content, privateKey),
                },
              };
            } catch {
              // If decryption fails, return as-is (might not be encrypted)
              return c;
            }
          }
        }

        // Handle message (non-streaming) format
        if (c.message && typeof c.message === 'object') {
          const message = c.message as Record<string, unknown>;
          if (
            typeof message.content === 'string' &&
            message.content.length > 0
          ) {
            try {
              return {
                ...c,
                message: {
                  ...message,
                  content: eciesDecrypt(message.content, privateKey),
                },
              };
            } catch {
              return c;
            }
          }
        }

        return c;
      }),
    };
  }

  return obj;
}

/**
 * Decrypt a non-streaming response body
 */
function decryptResponseBody(body: unknown, privateKey: string): unknown {
  return decryptChunk(body, privateKey);
}

/**
 * Extract chat completion ID from response chunk
 */
function extractIdFromChunk(chunk: string): string | null {
  const match = chunk.match(/"id"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

/**
 * Extract decrypted content from SSE chunk
 */
function extractContentFromDecryptedChunk(chunk: string): string {
  const match = chunk.match(/"delta"\s*:\s*\{[^}]*"content"\s*:\s*"([^"]*)"/);
  if (match?.[1]) {
    return match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  return '';
}

/**
 * Create an E2EE-enabled fetch function with attestation capture
 *
 * @param modelPublicKey - The model's public key from attestation (hex, 64 bytes)
 * @returns Object containing the wrapped fetch function and E2EE context
 */
export function createE2EEFetch(modelPublicKey: string): {
  fetch: typeof fetch;
  context: E2EEContext;
} {
  const passphrase = generatePassphrase(12);
  console.log('passphrase', passphrase);
  const clientKeyPair = generateKeyPair(passphrase);

  const context: E2EEContext = {
    clientKeyPair,
    modelPublicKey,
  };

  const e2eeFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Only apply E2EE to chat completions endpoint
    if (!url.includes('/chat/completions')) {
      return fetch(input, init);
    }

    // Parse and encrypt the request body
    let encryptedBodyString = '';
    let isStreaming = false;

    if (typeof init?.body === 'string') {
      try {
        const parsed: ChatCompletionRequest = JSON.parse(init.body);
        isStreaming = parsed.stream === true;
        const encrypted = encryptRequestBody(parsed, modelPublicKey);
        encryptedBodyString = JSON.stringify(encrypted);
      } catch {
        // If parsing fails, proceed without encryption
        encryptedBodyString = init.body;
      }
    }

    // Add E2EE headers (NEAR AI expected header names)
    const headers = new Headers(init?.headers);
    headers.set('X-Signing-Algo', 'ecdsa');
    headers.set('X-Client-Pub-Key', bytesToHex(clientKeyPair.publicKey));
    headers.set('X-Model-Pub-Key', modelPublicKey);

    // Clear previous capture and set up new one
    clearE2EECapture();

    // Make the request with encrypted body
    const response = await fetch(input, {
      ...init,
      body: encryptedBodyString,
      headers,
    });

    // For streaming responses, capture raw response and provide decrypted stream
    if (isStreaming && response.body) {
      // Clone response to capture raw content
      const [captureStream, decryptStream] = response.body.tee();

      // Set up capture promise
      capturePromise = (async (): Promise<E2EECapturedData | null> => {
        try {
          const reader = captureStream.getReader();
          const decoder = new TextDecoder();
          let rawResponseBody = '';
          let extractedId: string | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            rawResponseBody += chunk;
            if (!extractedId) {
              extractedId = extractIdFromChunk(chunk);
            }
          }

          // Now decrypt the response to get the output
          const lines = rawResponseBody.split('\n');
          let decryptedOutput = '';
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = line.slice(6);
                const parsed = JSON.parse(data);
                const decrypted = decryptChunk(
                  parsed,
                  bytesToHex(clientKeyPair.privateKey)
                );
                const decryptedLine = 'data: ' + JSON.stringify(decrypted);
                decryptedOutput +=
                  extractContentFromDecryptedChunk(decryptedLine);
              } catch {
                // Skip chunks that fail to parse/decrypt
              }
            }
          }

          return {
            passphrase,
            requestBody: encryptedBodyString,
            responseBody: rawResponseBody,
            id: extractedId,
            output: decryptedOutput,
          };
        } catch {
          return null;
        }
      })();

      // Return response with decrypting stream
      const decryptingStream = createDecryptingStream(
        bytesToHex(clientKeyPair.privateKey)
      );
      const decryptedBody = decryptStream.pipeThrough(decryptingStream);

      return new Response(decryptedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    // For non-streaming responses, capture and decrypt
    if (!isStreaming) {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        try {
          const rawResponseBody = await response.text();
          const body = JSON.parse(rawResponseBody);
          const decrypted = decryptResponseBody(
            body,
            bytesToHex(clientKeyPair.privateKey)
          );

          // Extract ID and output from decrypted response
          let extractedId: string | null = null;
          let decryptedOutput = '';
          if (decrypted && typeof decrypted === 'object') {
            const obj = decrypted as Record<string, unknown>;
            if (typeof obj.id === 'string') extractedId = obj.id;
            if (Array.isArray(obj.choices) && obj.choices[0]) {
              const choice = obj.choices[0] as Record<string, unknown>;
              if (choice.message && typeof choice.message === 'object') {
                const msg = choice.message as Record<string, unknown>;
                if (typeof msg.content === 'string') {
                  decryptedOutput = msg.content;
                }
              }
            }
          }

          // Set up capture with resolved data
          capturePromise = Promise.resolve({
            passphrase,
            requestBody: encryptedBodyString,
            responseBody: rawResponseBody,
            id: extractedId,
            output: decryptedOutput,
          });

          return new Response(JSON.stringify(decrypted), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch {
          // Return original response if decryption fails
          return response;
        }
      }
    }

    return response;
  };

  return { fetch: e2eeFetch, context };
}
