import { type ModelMessage, modelMessageSchema } from 'ai';

/** extract the model from a request body */
export function parseMessagesFromRequestBody(
  requestBody: string
): ModelMessage[] {
  const messages = JSON.parse(requestBody)?.messages;
  return messages.map((message: ModelMessage) =>
    modelMessageSchema.parse(message)
  );
}

/** extract the output from a response body (streaming or non-streaming) */
export function parseOutputFromResponseBody(responseBody: string): string {
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

/** decrypt an SSE response body */
export function decryptSSEResponseBody(
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
