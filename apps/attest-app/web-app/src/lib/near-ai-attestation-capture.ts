/**
 * NEAR AI Attestation Capture
 *
 * This module provides utilities to capture the raw request and response bodies
 * for NEAR AI API calls to enable proper attestation verification.
 *
 * The NEAR AI attestation system requires:
 * - Request hash: SHA256 of the exact JSON request body string
 * - Response hash: SHA256 of the exact response body string (for streaming,
 *   this includes all SSE chunks with "data: " prefixes and trailing newlines)
 *
 * See: https://docs.near.ai/cloud/verification/chat
 */

import type { AttestationChatData } from '@/stores/attestation-store'

/**
 * Captured attestation data from a NEAR AI API call
 */
interface CapturedAttestationData {
  /** The exact request body string sent to the API */
  requestBody: string
  /** The exact response body string received from the API (raw SSE for streaming) */
  responseBody: string
  /** The response ID extracted from the response */
  id: string | null
  /** The accumulated text content from the response */
  output: string
}

/** Promise that resolves when the capture is complete */
let capturePromise: Promise<CapturedAttestationData | null> | null = null

/**
 * Get the promise for the captured attestation data
 * Call this after the stream has started and await it to get the captured data
 */
export function getCapturePromise(): Promise<AttestationChatData | null> {
  if (!capturePromise) {
    return Promise.resolve(null)
  }

  return capturePromise.then((data) => {
    if (!data || !data.id) {
      return null
    }
    return {
      id: data.id,
      requestBody: data.requestBody,
      responseBody: data.responseBody,
      output: data.output,
    }
  })
}

/**
 * Clear the latest captured data
 */
export function clearLatestCapture(): void {
  capturePromise = null
}

/**
 * Convert captured data to AttestationChatData format
 * @deprecated Use getCapturePromise() instead for proper async handling
 */
export function captureToAttestationData(): AttestationChatData | null {
  console.warn(
    '[AttestationCapture] captureToAttestationData is deprecated, use getCapturePromise()'
  )
  return null
}

/**
 * Extract chat completion ID from SSE response chunk
 */
function extractIdFromChunk(chunk: string): string | null {
  // Match "id":"chatcmpl-xxx" pattern
  const match = chunk.match(/"id"\s*:\s*"([^"]+)"/)
  return match ? match[1] : null
}

/**
 * Extract text content from SSE response chunk
 */
function extractContentFromChunk(chunk: string): string {
  // Match "content":"xxx" pattern in delta
  const match = chunk.match(/"delta"\s*:\s*\{[^}]*"content"\s*:\s*"([^"]*)"/)
  if (match) {
    // Unescape JSON string
    return match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
  return ''
}

/**
 * Create a custom fetch function that captures request/response for attestation
 *
 * @param originalFetch - The original fetch function to wrap
 * @returns A wrapped fetch function that captures attestation data
 */
export function createAttestationCaptureFetch(
  originalFetch: typeof fetch = globalThis.fetch
): typeof fetch {
  return async function attestationCaptureFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Capture the request body
    const requestBody = typeof init?.body === 'string' ? init.body : ''

    // Clear previous capture
    capturePromise = null

    // Make the actual request
    const response = await originalFetch(input, init)

    // Only capture for streaming responses to chat completions endpoint
    const url = typeof input === 'string' ? input : input.toString()
    const isStreamingRequest =
      url.includes('/chat/completions') && requestBody.includes('"stream":true')

    if (!isStreamingRequest) {
      // For non-streaming, just return the response as-is
      return response
    }

    // Clone the response so we can read it and still return it
    const clonedResponse = response.clone()

    // Read and capture the streaming response
    const reader = clonedResponse.body?.getReader()
    if (!reader) {
      return response
    }

    const decoder = new TextDecoder()

    // Create a promise that captures the full response
    capturePromise = (async (): Promise<CapturedAttestationData | null> => {
      try {
        let rawResponseBody = ''
        let extractedId: string | null = null
        let extractedOutput = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          rawResponseBody += chunk

          // Extract ID from first chunk that has it
          if (!extractedId) {
            extractedId = extractIdFromChunk(chunk)
          }

          // Extract content from chunks
          // Split by lines and process each data line
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              extractedOutput += extractContentFromChunk(line)
            }
          }
        }

        console.debug('[AttestationCapture] Captured attestation data:', {
          id: extractedId,
          requestBodyLength: requestBody.length,
          responseBodyLength: rawResponseBody.length,
          outputLength: extractedOutput.length,
        })

        return {
          requestBody,
          responseBody: rawResponseBody,
          id: extractedId,
          output: extractedOutput,
        }
      } catch (error) {
        console.warn('[AttestationCapture] Failed to capture response:', error)
        return null
      }
    })()

    // Return the original response for normal processing
    return response
  }
}
