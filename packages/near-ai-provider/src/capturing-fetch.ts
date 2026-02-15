import type { NearAIChatModelId } from '@repo/packages-utils/near';
import type { KeyPair } from '@repo/packages-utils/e2ee';
import type { E2EEContext } from './e2ee-context.js';
import type { CapturedResponse } from './types.js';
import { generatePassphrase } from '@repo/packages-utils/passphrase';
import {
  toUnprefixedPublicKey,
  generateKeyPair,
  generateKeyPairFromPassphrase,
  parseRequestBody,
  decryptSSEStream,
} from '@repo/packages-utils/e2ee';
import { bytesToHex } from '@noble/curves/utils.js';

export let capturedResponsePromise = Promise.resolve<CapturedResponse | null>(
  null
);

/** a wrapper around fetch that captures the raw request and response bodies
 * will encrypt the request body if E2EE is enabled
 * will decrypt the response body if E2EE is enabled
 */
export function createCapturingFetch(
  createE2EEContext?: (model: NearAIChatModelId) => Promise<E2EEContext>,
  customFetch?: typeof fetch
): typeof fetch {
  const capturingFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers = new Headers(init?.headers);

    let requestBody = init?.body;

    // E2EE only supports chat completions endpoint
    if (!url.includes('/chat/completions')) {
      throw new Error('E2EE only supports chat completions endpoint');
    } else if (typeof requestBody !== 'string') {
      throw new Error('request body must be a string');
    }

    // clear any previous capture
    capturedResponsePromise = Promise.resolve(null);
    const parsedBody = parseRequestBody(requestBody);

    let e2eeContext: E2EEContext | undefined = createE2EEContext
      ? await createE2EEContext(parsedBody.model)
      : undefined;

    const ourPassphrase = generatePassphrase(6);
    let ephemeralKeyPairs: KeyPair[] | undefined;
    let ourKeyPair: KeyPair | undefined;
    let modelsPublicKey: Uint8Array | undefined;
    if (e2eeContext) {
      ourKeyPair = generateKeyPairFromPassphrase(ourPassphrase);
      modelsPublicKey = e2eeContext.modelsPublicKey;
      headers.set('X-Signing-Algo', 'ecdsa');
      headers.set('X-Client-Pub-Key', bytesToHex(ourKeyPair.publicKey));
      headers.set(
        'X-Model-Pub-Key',
        // remove 0x04 prefix
        bytesToHex(toUnprefixedPublicKey(modelsPublicKey))
      );
    }

    // encrypt the request body
    if (e2eeContext && ourKeyPair) {
      ephemeralKeyPairs = parsedBody.messages.map(() => generateKeyPair());
      requestBody = JSON.stringify(
        e2eeContext.encryptRequestBody(ephemeralKeyPairs, parsedBody)
      );
    }

    // make the request
    const response = await (customFetch ?? fetch)(input, {
      ...init,
      headers,
      body: requestBody,
    });

    if (parsedBody.stream) {
      let responseBody = '';
      let buffer = '';
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Create a transform stream that captures data as it passes through
      const transformStream = new TransformStream({
        transform(_chunk, controller) {
          const decodedChunk = decoder.decode(_chunk, { stream: true });
          // Capture the chunk
          responseBody += decodedChunk;

          let chunk = _chunk;
          if (e2eeContext) {
            const { chunk: decryptedChunk, buffer: newBuffer } =
              decryptSSEStream(ourKeyPair!, buffer + decodedChunk);
            chunk = encoder.encode(decryptedChunk);
            buffer = newBuffer;
          }

          // Pass it through to the consumer
          controller.enqueue(chunk);
        },
        flush() {
          // When the stream is done, resolve the captured response
          capturedResponsePromise = Promise.resolve(
            e2eeContext
              ? {
                  e2ee: true as const,
                  modelsPublicKey: bytesToHex(modelsPublicKey!),
                  ephemeralPrivateKeys: ephemeralKeyPairs!.map((k) =>
                    bytesToHex(k.privateKey)
                  ),
                  ourPassphrase: ourPassphrase!,
                  requestBody,
                  responseBody,
                }
              : {
                  e2ee: false as const,
                  ourPassphrase: ourPassphrase!,
                  requestBody,
                  responseBody,
                }
          );
        },
      });

      // Pipe the response through the transform stream
      const transformedStream = response.body!.pipeThrough(transformStream);

      return new Response(transformedStream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } else {
      const clone = response.clone();
      const responseBody = await clone.text();

      capturedResponsePromise = Promise.resolve(
        e2eeContext && ourKeyPair
          ? {
              e2ee: true as const,
              modelsPublicKey: bytesToHex(modelsPublicKey!),
              ephemeralPrivateKeys: ephemeralKeyPairs!.map((k) =>
                bytesToHex(k.privateKey)
              ),
              ourPassphrase: ourPassphrase!,
              requestBody,
              responseBody,
            }
          : {
              e2ee: false as const,
              ourPassphrase: ourPassphrase!,
              requestBody,
              responseBody,
            }
      );
      return response;
    }
  };

  return capturingFetch;
}
