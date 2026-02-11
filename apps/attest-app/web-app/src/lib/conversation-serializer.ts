import type { AttestationChatData } from '@/stores/attestation-store'
import {
  toPrefixedPublicKey,
  deriveSharedSecret,
} from '@repo/packages-utils/e2ee'
import { hexToBytes } from '@noble/curves/utils.js'
import { gcm } from '@noble/ciphers/aes.js'

export interface ConversationMessage {
  role: string
  content: string
}

/**
 * Parse and decrypt messages from AttestationChatData
 */
export function decryptMessages(
  chatData: AttestationChatData
): ConversationMessage[] {
  const messages: ConversationMessage[] = []

  try {
    let requestData: any

    if (chatData.modelsPublicKey && chatData.ephemeralPrivateKeys) {
      // E2EE is enabled - need to decrypt
      const modelsPublicKey = toPrefixedPublicKey(
        hexToBytes(chatData.modelsPublicKey)
      )
      const ephemeralPrivateKeys = chatData.ephemeralPrivateKeys.map(
        (key: string) => hexToBytes(key)
      )

      // Parse the encrypted request body
      const encryptedRequestData = JSON.parse(chatData.requestBody)

      // Decrypt each message in the request
      requestData = {
        ...encryptedRequestData,
        messages: encryptedRequestData.messages.map(
          (msg: any, index: number) => {
            if (typeof msg.content === 'string' && msg.content.length > 0) {
              try {
                const ciphertextHex = msg.content
                const packedCiphertext = hexToBytes(ciphertextHex)

                // Unpack: ephemeralPublicKey (65 bytes) || iv (12 bytes) || ciphertext
                const iv = packedCiphertext.slice(65, 77)
                const ciphertext = packedCiphertext.slice(77)

                // Derive the shared secret
                const sharedSecret = deriveSharedSecret(
                  ephemeralPrivateKeys[index],
                  modelsPublicKey
                )

                // Decrypt using AES-256-GCM
                const cipher = gcm(sharedSecret, iv)
                const plaintextBytes = cipher.decrypt(ciphertext)
                const plaintext = new TextDecoder().decode(plaintextBytes)

                return {
                  ...msg,
                  content: plaintext,
                }
              } catch (err) {
                console.error('Failed to decrypt message:', err)
                return msg
              }
            }
            return msg
          }
        ),
      }
    } else {
      // No E2EE - just parse normally
      requestData = JSON.parse(chatData.requestBody)
    }

    // Add all user and system messages from request
    if (requestData.messages && Array.isArray(requestData.messages)) {
      for (const msg of requestData.messages) {
        if (msg.role && msg.content) {
          messages.push({
            role: msg.role,
            content: msg.content,
          })
        }
      }
    }

    // Add the assistant response (output is already decrypted)
    if (chatData.output) {
      messages.push({
        role: 'assistant',
        content: chatData.output,
      })
    }
  } catch (error) {
    console.error('Failed to decrypt messages:', error)
  }

  return messages
}

/**
 * Extract text range from a specific message
 */
export function extractTextRange(
  messageContent: string,
  startChar: number,
  endChar: number
): string {
  return messageContent.slice(startChar, endChar)
}

/**
 * Get preview text with max length
 */
export function getPreviewText(text: string, maxLength: number = 50): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}
