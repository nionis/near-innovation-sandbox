import type { ModelMessage } from 'ai';
import type { NearAIChatModelId } from '@repo/packages-utils/near';
import type { KeyPair, E2EEContext } from './types.js';
import { ModelPublicKeys } from './model-public-keys.js';
import { encryptForModel, decryptFromModel } from './crypto.js';
import { hexToBytes, bytesToHex } from '@noble/curves/utils.js';

export class E2EE {
  private modelPubKeyCache: ModelPublicKeys;

  constructor(baseURL: string) {
    this.modelPubKeyCache = new ModelPublicKeys(baseURL);
  }

  public async createContext(model: NearAIChatModelId): Promise<E2EEContext> {
    const modelsPublicKey = await this.modelPubKeyCache.get(model).then((o) => {
      return hexToBytes(o.signingPublicKey);
    });
    const prefixedModelsPublicKey = Uint8Array.from([0x04, ...modelsPublicKey]);

    return {
      modelsPublicKey: prefixedModelsPublicKey,
      encrypt: (
        ourKeyPair: KeyPair,
        messages: ModelMessage[]
      ): ModelMessage[] => {
        const encryptedMessages = messages.map<ModelMessage>((message) => {
          if (
            typeof message.content === 'string' &&
            message.content.length > 0
          ) {
            return {
              ...message,
              content: bytesToHex(
                encryptForModel(
                  ourKeyPair,
                  prefixedModelsPublicKey,
                  message.content
                )
              ),
            } as unknown as ModelMessage;
          }
          return message;
        });
        return encryptedMessages;
      },
      decrypt: (ourKeyPair: KeyPair, ciphertext: string): string => {
        const packedCiphertext = hexToBytes(ciphertext);
        const plaintextBytes = decryptFromModel(ourKeyPair, packedCiphertext);
        return new TextDecoder().decode(plaintextBytes);
      },
    };
  }
}
