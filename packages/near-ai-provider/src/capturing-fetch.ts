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
  encryptRequestBody,
} from '@repo/packages-utils/e2ee';
import { bytesToHex } from '@noble/curves/utils.js';

export let capturedResponsePromise = Promise.resolve<CapturedResponse | null>(
  null
);

/** a wrapper around fetch that captures the raw request and response bodies
 * will encrypt the request body if E2EE is enabled
 */
export function createCapturingFetch(
  createE2EEContext?: (model: NearAIChatModelId) => Promise<E2EEContext>
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
    const response = await fetch(input, {
      ...init,
      headers,
      body: requestBody,
    });

    if (parsedBody.stream) {
      const [captureStream, stream] = response.body!.tee();

      // read the captured stream in the background
      (async () => {
        const reader = captureStream.getReader();
        const decoder = new TextDecoder();
        let responseBody = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          responseBody += chunk;
        }

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
      })();

      // return new stream
      return new Response(stream, {
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
