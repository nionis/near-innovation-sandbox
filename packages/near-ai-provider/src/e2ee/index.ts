import type { ModelMessage } from 'ai';
import type { NearAIChatModelId } from '@repo/packages-utils/near';
import type { KeyPair } from './types.js';
import { ModelPublicKeys } from './model-public-keys.js';
import { generatePassphrase } from '../passphrase.js';
import { generateKeyPair, eciesEncrypt, eciesDecrypt } from './crypto.js';
import { hexToBytes, bytesToHex } from '@noble/curves/utils.js';

export interface E2EEContext {
  passphrase: string[];
  ourKeyPair: KeyPair;
  headers: Headers;
  encrypt: (messages: ModelMessage[]) => ModelMessage[];
  decrypt: (ciphertext: string) => string;
}

export class E2EE {
  private modelPubKeyCache: ModelPublicKeys;

  constructor(baseURL: string) {
    this.modelPubKeyCache = new ModelPublicKeys(baseURL);
  }

  public async createContext(model: NearAIChatModelId): Promise<E2EEContext> {
    const modelPubKey = await this.modelPubKeyCache.get(model).then((o) => {
      return hexToBytes(o.signingPublicKey);
    });
    const passphrase = generatePassphrase(6);
    const ourKeyPair = generateKeyPair(passphrase);
    const textDecoder = new TextDecoder();

    const headers = new Headers();
    headers.set('X-Signing-Algo', 'ecdsa');
    headers.set('X-Client-Pub-Key', bytesToHex(ourKeyPair.publicKey));
    headers.set('X-Model-Pub-Key', bytesToHex(modelPubKey));

    const prefixedModelPubKey = Uint8Array.from([0x04, ...modelPubKey]);

    return {
      passphrase,
      ourKeyPair,
      headers,
      encrypt: (messages: ModelMessage[]): ModelMessage[] => {
        const encryptedMessages = messages.map<ModelMessage>((message) => {
          if (
            typeof message.content === 'string' &&
            message.content.length > 0
          ) {
            return {
              ...message,
              content: bytesToHex(
                eciesEncrypt(prefixedModelPubKey, message.content)
              ),
            } as unknown as ModelMessage;
          }
          return message;
        });
        return encryptedMessages;
      },
      decrypt: (ciphertext: string): string => {
        const packedCiphertext = hexToBytes(ciphertext);
        const plaintextBytes = eciesDecrypt(
          ourKeyPair.privateKey,
          packedCiphertext
        );
        return textDecoder.decode(plaintextBytes);
      },
    };
  }
}
