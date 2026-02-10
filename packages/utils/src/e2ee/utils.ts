import type { KeyPair, ParsedRequestBody } from './types.js';
import { type ModelMessage, modelMessageSchema } from 'ai';
import { encryptForModel, decryptFromModel } from './index.js';
import { bytesToHex, hexToBytes } from '@noble/curves/utils.js';

/** parse a request body from AI SDK */
export function parseRequestBody(requestBody: string): ParsedRequestBody {
  const parsedBody: ParsedRequestBody = JSON.parse(
    requestBody
  ) as ParsedRequestBody;
  parsedBody.messages = parsedBody.messages.map((message) =>
    modelMessageSchema.parse(message)
  );
  return parsedBody;
}

/** parse a response body from AI SDK to output text */
export function extractOutputFromResponseBody(responseBody: string): string {
  // Check if it's a streaming response (SSE format with "data:" lines)
  if (responseBody.includes('data: {')) {
    // Parse Server-Sent Events (SSE) format
    const lines = responseBody.split('\n');
    let output = '';

    for (const line of lines) {
      // Skip empty lines and [DONE] marker
      if (!line.trim() || line.includes('[DONE]')) {
        continue;
      }

      // Parse lines that start with "data: "
      if (line.startsWith('data: ')) {
        try {
          const jsonStr = line.slice(6); // Remove "data: " prefix
          const chunk = JSON.parse(jsonStr);

          // Extract content from delta (streaming format)
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            output += content;
          }
        } catch {
          // Skip malformed chunks
          continue;
        }
      }
    }

    return output;
  } else {
    // Non-streaming response: regular JSON format
    const parsed = JSON.parse(responseBody);
    return parsed?.choices?.[0]?.message?.content ?? '';
  }
}

/** encrypt a list of messages using ECIES */
function encryptMessagesForModel(
  modelsPublicKey: Uint8Array,
  ephemeralKeyPairs: KeyPair[],
  messages: ModelMessage[]
): ModelMessage[] {
  const encryptedMessages = messages.map<ModelMessage>((message, index) => {
    if (typeof message.content === 'string' && message.content.length > 0) {
      return {
        ...message,
        content: bytesToHex(
          encryptForModel(
            ephemeralKeyPairs[index]!,
            modelsPublicKey,
            message.content
          )
        ),
      } as unknown as ModelMessage;
    }
    return message;
  });
  return encryptedMessages;
}

/** encrypt a request body */
export function encryptRequestBody(
  modelsPublicKey: Uint8Array,
  ephemeralKeyPairs: KeyPair[],
  parsedBody: ParsedRequestBody
): ParsedRequestBody {
  return {
    ...parsedBody,
    messages: encryptMessagesForModel(
      modelsPublicKey,
      ephemeralKeyPairs,
      parsedBody.messages
    ),
  };
}

/** decrypt a response body */
export function extractAndDecryptResponseBodyOutput(
  ourKeyPair: KeyPair,
  responseBody: string
): string {
  return decryptSSEResponseBodyOutput(
    (ciphertext: string) => decryptCiphertext(ourKeyPair, ciphertext),
    responseBody
  );
}

/** decrypt an SSE response body and extract the output */
function decryptSSEResponseBodyOutput(
  decrypt: (ciphertext: string) => string,
  buffer: string
) {
  let responseBody = '';
  // Process complete lines from the SSE stream
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim() || line.trim() === 'data: [DONE]') {
      continue;
    }

    if (line.startsWith('data: ')) {
      try {
        const jsonStr = line.slice(6); // Remove "data: " prefix
        const parsed = JSON.parse(jsonStr);

        // Check if it's an error response (not encrypted)
        if (parsed.error) {
          throw new Error(parsed.error.message || 'Unknown error');
        }

        // Decrypt the content field if present
        const choices = parsed.choices;
        if (choices && choices.length > 0) {
          const delta = choices[0].delta;
          if (delta && delta.content) {
            // Decrypt the content
            const decryptedContent = decrypt(delta.content);
            responseBody += decryptedContent;
          }
        }
      } catch (err) {
        // If parsing or decryption fails, throw the error
        console.error('Error processing SSE line:', err);
        throw err;
      }
    }
  }

  return responseBody;
}

/** decrypt a ciphertext string using ECIES */
function decryptCiphertext(ourKeyPair: KeyPair, ciphertext: string): string {
  const packedCiphertext = hexToBytes(ciphertext);
  const plaintextBytes = decryptFromModel(ourKeyPair, packedCiphertext);
  return new TextDecoder().decode(plaintextBytes);
}
