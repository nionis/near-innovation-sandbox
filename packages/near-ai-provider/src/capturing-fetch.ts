import type { ModelMessage } from 'ai';
import type { NearAIChatModelId } from '@repo/packages-utils/near';
import type { CapturedResponse } from './types.js';
import type { E2EEContext, KeyPairFromPassphrase } from './e2ee/types.js';
import { generatePassphrase } from './passphrase.js';
import { generateKeyPairFromPassphrase } from './e2ee/crypto.js';
import { bytesToHex } from '@noble/curves/utils.js';

export let capturedResponsePromise = Promise.resolve<CapturedResponse | null>(
  null
);

/** a wrapper around fetch that captures the raw request and response bodies */
export function createCapturingFetch(
  createE2EEContext?: (model: NearAIChatModelId) => Promise<E2EEContext>
): typeof fetch {
  const capturingFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    const headers = new Headers(init?.headers);
    let requestBody = init?.body;
    let encryptedRequestBody: string | undefined;

    // E2EE only supports chat completions endpoint
    if (!url.includes('/chat/completions')) {
      throw new Error('E2EE only supports chat completions endpoint');
    } else if (typeof requestBody !== 'string') {
      throw new Error('request body must be a string');
    }

    // clear any previous capture
    capturedResponsePromise = Promise.resolve(null);

    // find out if it's streaming or not
    let parsedBody: {
      messages: ModelMessage[];
      model: NearAIChatModelId;
      stream: boolean;
    };
    try {
      parsedBody = JSON.parse(requestBody);
    } catch {
      throw new Error('failed to parse request body');
    }

    let e2eeContext: E2EEContext | undefined = createE2EEContext
      ? await createE2EEContext(parsedBody.model)
      : undefined;

    let ourKeyPair: KeyPairFromPassphrase | undefined;
    let modelsPublicKeyHex: string | undefined;
    if (e2eeContext) {
      const _passphrase = generatePassphrase(6);
      const _ourKeyPair = generateKeyPairFromPassphrase(_passphrase);
      ourKeyPair = {
        passphrase: _passphrase,
        privateKey: _ourKeyPair.privateKey,
        publicKey: _ourKeyPair.publicKey,
      };
      modelsPublicKeyHex = bytesToHex(e2eeContext.modelsPublicKey);

      headers.set('X-Signing-Algo', 'ecdsa');
      headers.set('X-Client-Pub-Key', bytesToHex(ourKeyPair.publicKey));
      headers.set('X-Model-Pub-Key', modelsPublicKeyHex);
    }

    // encrypt the request body
    if (e2eeContext && ourKeyPair) {
      const encryptedMessages = e2eeContext.encrypt(
        ourKeyPair,
        parsedBody.messages
      );
      encryptedRequestBody = JSON.stringify({
        ...parsedBody,
        messages: encryptedMessages,
      });
    }

    // make the request
    const response = await fetch(input, {
      ...init,
      headers,
      body: e2eeContext ? encryptedRequestBody : requestBody,
    });

    if (parsedBody.stream) {
      const [captureStream, stream] = response.body!.tee();

      // read the captured stream in the background
      (async () => {
        const reader = captureStream.getReader();
        const decoder = new TextDecoder();
        let _responseBody = '';
        let _decryptedResponseBody = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          _responseBody += chunk;
          _decryptedResponseBody += chunk;
        }

        capturedResponsePromise = Promise.resolve(
          e2eeContext && ourKeyPair
            ? {
                e2ee: true as const,
                requestBody,
                encryptedRequestBody: encryptedRequestBody!,
                responseBody: _responseBody,
                decryptedResponseBody: _decryptedResponseBody!,
                passphrase: ourKeyPair.passphrase,
                modelsPublicKey: modelsPublicKeyHex!,
              }
            : {
                e2ee: false as const,
                requestBody,
                responseBody: _responseBody,
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
              requestBody,
              encryptedRequestBody: encryptedRequestBody!,
              responseBody: e2eeContext.decrypt(ourKeyPair, responseBody!),
              decryptedResponseBody: responseBody!,
              passphrase: ourKeyPair.passphrase,
              modelsPublicKey: modelsPublicKeyHex!,
            }
          : {
              e2ee: false as const,
              requestBody,
              responseBody: responseBody!,
              decryptedResponseBody: undefined,
              passphrase: undefined,
            }
      );
      return response;
    }
  };

  return capturingFetch;
}
