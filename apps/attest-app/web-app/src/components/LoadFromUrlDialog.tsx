import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Link as LinkIcon, AlertCircle, Camera, X } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  downloadBinary,
  decryptString,
  SHARE_API_URL as DEFAULT_SHARE_API_URL,
} from '@repo/packages-utils/share'
import { useAttestationStore } from '@/stores/attestation-store'
import { useThreads } from '@/hooks/useThreads'
import { useMessages } from '@/hooks/useMessages'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ulid } from 'ulidx'
import {
  generateKeyPairFromPassphrase,
  parseRequestBody,
  toPrefixedPublicKey,
  deriveSharedSecret,
  decryptSSEStream,
} from '@repo/packages-utils/e2ee'
import { hexToBytes } from '@noble/curves/utils.js'
import { gcm } from '@noble/ciphers/aes.js'
import type { AttestationChatData } from '@/stores/attestation-store'
import { convertUIMessageToThreadMessage, parseReasoning } from '@/lib/messages'
import type { UIMessage } from '@ai-sdk/react'

const SHARE_API_URL = IS_DEV ? 'http://localhost:3000' : DEFAULT_SHARE_API_URL

interface LoadFromUrlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoadFromUrlDialog({
  open,
  onOpenChange,
}: LoadFromUrlDialogProps) {
  const [url, setUrl] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsPassphrase, setNeedsPassphrase] = useState(false)
  const [downloadedData, setDownloadedData] = useState<Uint8Array | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerRef = useRef<HTMLDivElement>(null)

  const { openVerificationDialog } = useAttestationStore()
  const { createThread, setCurrentThreadId } = useThreads()
  const { addMessage } = useMessages()
  const navigate = useNavigate()

  // Cleanup scanner on unmount or when dialog closes
  useEffect(() => {
    if (!open && isScanning) {
      stopScanner()
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .catch((err) => console.error('Error stopping scanner:', err))
      }
    }
  }, [])

  const startScanner = async () => {
    setScannerError(null)
    setError(null)
    setIsScanning(true)

    // Wait for the DOM element to be rendered
    setTimeout(async () => {
      try {
        const scannerId = 'qr-reader'
        const element = document.getElementById(scannerId)

        if (!element) {
          throw new Error('Scanner element not found')
        }

        html5QrCodeRef.current = new Html5Qrcode(scannerId)

        await html5QrCodeRef.current.start(
          { facingMode: 'environment' }, // Use back camera on mobile
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Success callback when QR code is scanned
            setUrl(decodedText)
            stopScanner()
            setScannerError(null)
          },
          (_errorMessage) => {
            // Error callback (called frequently, not an actual error)
            // We can ignore this as it's called on every frame without a QR code
          }
        )
      } catch (err) {
        console.error('Error starting scanner:', err)
        setScannerError(
          err instanceof Error
            ? err.message
            : 'Failed to access camera. Please ensure camera permissions are granted.'
        )
        setIsScanning(false)
      }
    }, 100) // Small delay to ensure DOM is ready
  }

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current = null
      }
      setIsScanning(false)
      setScannerError(null)
    } catch (err) {
      console.error('Error stopping scanner:', err)
    }
  }

  const parseUrl = (urlString: string) => {
    try {
      // Handle multiple URL formats:
      // 1. http://localhost:3000/id=xxx&passphrase=yyy-zzz
      // 2. http://localhost:3000/?id=xxx&passphrase=yyy-zzz
      // 3. Direct paste of id and passphrase: id=xxx&passphrase=yyy-zzz

      let queryString = ''

      if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
        const urlObj = new URL(urlString)
        queryString = urlObj.search.substring(1) // Remove leading ?

        // If no query string with ?, check if it's in the pathname (format: /id=xxx&passphrase=yyy)
        if (!queryString && urlObj.pathname.includes('=')) {
          queryString = urlObj.pathname.substring(1) // Remove leading /
        }
      } else {
        // Assume it's just the query string
        queryString = urlString
      }

      const params = new URLSearchParams(queryString)
      const id = params.get('id')
      const passphraseParam = params.get('passphrase')

      if (!id) {
        throw new Error('URL must contain an id parameter')
      }

      return {
        id,
        passphrase: passphraseParam
          ? passphraseParam.split('-').filter((s) => s.trim())
          : null,
      }
    } catch (err) {
      throw new Error(
        'Invalid URL format. Expected format: http://example.com/id=xxx&passphrase=yyy-zzz or id=xxx&passphrase=yyy-zzz'
      )
    }
  }

  const handleLoad = async () => {
    setError(null)
    setIsLoading(true)

    try {
      // Parse URL to get id and passphrase
      const { id, passphrase: urlPassphrase } = parseUrl(url)
      setShareId(id)

      // Download encrypted data
      const encryptedData = await downloadBinary(SHARE_API_URL, id)
      setDownloadedData(encryptedData)

      // If URL has passphrase, try to decrypt immediately
      if (urlPassphrase && urlPassphrase.length > 0) {
        await decryptAndLoad(encryptedData, urlPassphrase, id)
      } else {
        // Need user to provide passphrase
        setNeedsPassphrase(true)
        setIsLoading(false)
      }
    } catch (err) {
      console.error('Failed to load from URL:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to load conversation'
      )
      setIsLoading(false)
    }
  }

  const handleDecryptWithPassphrase = async () => {
    if (!downloadedData || !shareId) return

    setError(null)
    setIsLoading(true)

    try {
      const passphraseArray = passphrase
        .split('-')
        .map((s) => s.trim())
        .filter((s) => s)
      if (passphraseArray.length === 0) {
        throw new Error('Please enter a valid passphrase')
      }

      await decryptAndLoad(downloadedData, passphraseArray, shareId)
    } catch (err) {
      console.error('Failed to decrypt:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to decrypt conversation'
      )
      setIsLoading(false)
    }
  }

  // Helper function to parse message content and create proper UIMessage parts
  const parseMessageContentToParts = (content: any): any[] => {
    const parts: any[] = []

    if (typeof content === 'string') {
      // Parse the string to extract reasoning/thinking content
      const { reasoningSegment, textSegment } = parseReasoning(content)

      // Add reasoning part if present
      if (reasoningSegment) {
        const completedMatch = reasoningSegment.match(
          /<think>([\s\S]*?)<\/think>/
        )
        if (completedMatch) {
          parts.push({
            type: 'reasoning',
            text: completedMatch[1],
          })
        } else {
          // In-progress reasoning - extract content after <think> tag
          const inProgressMatch = reasoningSegment.match(/<think>([\s\S]*)/)
          if (inProgressMatch) {
            parts.push({
              type: 'reasoning',
              text: inProgressMatch[1],
            })
          }
        }
      }

      // Add text part if present
      if (textSegment) {
        const trimmedText = textSegment.trim()
        if (trimmedText) {
          parts.push({
            type: 'text',
            text: trimmedText,
          })
        }
      } else if (!reasoningSegment) {
        // No reasoning, just add the text as-is
        parts.push({
          type: 'text',
          text: content,
        })
      }
    } else if (Array.isArray(content)) {
      // Handle multimodal content
      for (const contentPart of content) {
        if (contentPart.type === 'text') {
          // Parse each text part for thinking content
          const textContent = contentPart.text || ''
          const { reasoningSegment, textSegment } = parseReasoning(textContent)

          // Add reasoning part if present
          if (reasoningSegment) {
            const completedMatch = reasoningSegment.match(
              /<think>([\s\S]*?)<\/think>/
            )
            if (completedMatch) {
              parts.push({
                type: 'reasoning',
                text: completedMatch[1],
              })
            } else {
              const inProgressMatch = reasoningSegment.match(/<think>([\s\S]*)/)
              if (inProgressMatch) {
                parts.push({
                  type: 'reasoning',
                  text: inProgressMatch[1],
                })
              }
            }
          }

          // Add text part if present
          if (textSegment) {
            const trimmedText = textSegment.trim()
            if (trimmedText) {
              parts.push({
                type: 'text',
                text: trimmedText,
              })
            }
          } else if (!reasoningSegment && textContent) {
            parts.push({
              type: 'text',
              text: textContent,
            })
          }
        } else if (contentPart.type === 'image_url') {
          parts.push({
            type: 'file',
            mediaType: 'image/jpeg',
            url: contentPart.image_url?.url || '',
          })
        }
      }
    }

    // Ensure at least one part exists
    if (parts.length === 0) {
      parts.push({
        type: 'text',
        text: '',
      })
    }

    return parts
  }

  const reconstructConversation = async (
    chatData: AttestationChatData,
    messageId: string,
    timestamp: number
  ): Promise<string | null> => {
    try {
      // Decrypt the E2EE encrypted content if necessary
      let requestData: any
      let output = chatData.output

      if (chatData.modelsPublicKey && chatData.ephemeralPrivateKeys) {
        // E2EE is enabled - need to decrypt
        const modelsPublicKey = toPrefixedPublicKey(
          hexToBytes(chatData.modelsPublicKey)
        )
        const ephemeralPrivateKeys = chatData.ephemeralPrivateKeys.map(
          (key: string) => hexToBytes(key)
        )
        const ourKeyPair = generateKeyPairFromPassphrase(chatData.ourPassphrase)

        // Parse the encrypted request body
        const encryptedRequestData = parseRequestBody(chatData.requestBody)

        // Decrypt each message in the request
        requestData = {
          ...encryptedRequestData,
          messages: encryptedRequestData.messages.map(
            (msg: any, index: number) => {
              if (typeof msg.content === 'string' && msg.content.length > 0) {
                try {
                  // The message was encrypted using: ephemeralPrivateKey + modelsPublicKey
                  // To decrypt, derive the same shared secret
                  const ciphertextHex = msg.content
                  const packedCiphertext = hexToBytes(ciphertextHex)

                  // Unpack: ephemeralPublicKey (65 bytes) || iv (12 bytes) || ciphertext
                  // Note: ephemeralPublicKey is packed in the ciphertext but we don't need it
                  // since we already have the ephemeral private keys
                  const iv = packedCiphertext.slice(65, 77)
                  const ciphertext = packedCiphertext.slice(77)

                  // Derive the shared secret using ephemeral private key + model's public key
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

        // Decrypt the response body using the existing decryptSSEStream utility
        try {
          const { content: decryptedContent } = decryptSSEStream(
            ourKeyPair,
            chatData.responseBody
          )
          output = decryptedContent || chatData.output
        } catch (err) {
          console.error('Failed to decrypt response:', err)
          output = chatData.output
        }
      } else {
        // No E2EE - just parse normally
        requestData = parseRequestBody(chatData.requestBody)
      }

      // Extract model information
      const model: ThreadModel = {
        id: requestData.model || 'llama3.1-8b',
        provider: 'near-ai', // Default to near-ai since that's what we use for attestation
      }

      // Create a new thread
      const threadTitle = `Shared Conversation - ${new Date(
        timestamp || Date.now()
      ).toLocaleString()}`

      const newThread = await createThread(
        model,
        threadTitle,
        undefined, // assistant
        undefined, // projectMetadata
        false // isTemporary
      )

      // Reconstruct and add messages from the shared data
      if (requestData.messages && Array.isArray(requestData.messages)) {
        // Convert each message to UIMessage format first, then to ThreadMessage
        for (let i = 0; i < requestData.messages.length; i++) {
          const msg = requestData.messages[i]

          if (msg.role && msg.content) {
            // Parse content and create proper parts (including reasoning if present)
            const parts = parseMessageContentToParts(msg.content)

            // Create UIMessage from the decrypted message
            const uiMessage: any = {
              id: `msg-${i}-${ulid()}`,
              role: msg.role as 'user' | 'assistant' | 'system',
              parts,
              createdAt: timestamp || Date.now(),
            }

            // Convert UIMessage to ThreadMessage using the utility function
            const threadMessage = convertUIMessageToThreadMessage(
              uiMessage,
              newThread.id
            )
            addMessage(threadMessage)
          }
        }
      }

      // Add the assistant response message
      // Parse the output to extract reasoning (thinking) content if present
      const assistantParts = parseMessageContentToParts(output)

      const assistantUIMessage: any = {
        id: messageId,
        role: 'assistant',
        parts: assistantParts,
        createdAt: timestamp || Date.now(),
      }

      const assistantThreadMessage = convertUIMessageToThreadMessage(
        assistantUIMessage as UIMessage,
        newThread.id
      )
      addMessage(assistantThreadMessage)

      setCurrentThreadId(newThread.id)
      return newThread.id
    } catch (err) {
      console.error('Failed to reconstruct conversation:', err)
      return null
    }
  }

  const decryptAndLoad = async (
    encryptedData: Uint8Array,
    passphraseArray: string[],
    messageId: string
  ) => {
    try {
      // Decrypt the data
      const decryptedString = decryptString(encryptedData, passphraseArray)
      const data = JSON.parse(decryptedString)

      // Validate the data structure
      if (!data.chatData || !data.receipt) {
        throw new Error('Invalid data format: missing required fields')
      }

      // Store the data in attestation store first
      const { setChatData, setReceipt, setShareUrl } =
        useAttestationStore.getState()
      setChatData(messageId, data.chatData)
      setReceipt(messageId, data.receipt)

      // Store the share URL so reference scanning can work
      // Reconstruct the full share URL from the share ID and passphrase
      const shareUrl = `${SHARE_API_URL}/?id=${messageId}&passphrase=${passphraseArray.join('-')}`
      const contentHash = data.receipt?.proofHash || messageId // Use proofHash as content identifier
      setShareUrl(messageId, shareUrl, contentHash)

      // Reconstruct the conversation thread
      const threadId = await reconstructConversation(
        data.chatData,
        messageId,
        data.timestamp
      )

      // Open verification dialog with the loaded data
      openVerificationDialog(messageId, data.verificationResult)

      // Reset and close dialog
      handleClose()

      // Navigate to the new thread if created successfully
      if (threadId) {
        navigate({ to: '/threads/$threadId', params: { threadId } })
      }
    } catch (err) {
      console.error('Failed to decrypt and load:', err)
      throw new Error('Failed to decrypt: Invalid passphrase or corrupted data')
    }
  }

  const handleClose = () => {
    setUrl('')
    setPassphrase('')
    setError(null)
    setIsLoading(false)
    setNeedsPassphrase(false)
    setDownloadedData(null)
    setShareId(null)
    setScannerError(null)
    if (isScanning) {
      stopScanner()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="size-5" />
            Scan QR Code
          </DialogTitle>
          <DialogDescription>
            {needsPassphrase
              ? 'Enter the passphrase to decrypt this conversation'
              : 'Enter a shared conversation URL to load it or scan a QR code'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {scannerError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{scannerError}</AlertDescription>
            </Alert>
          )}

          {!needsPassphrase ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="url">Conversation URL</Label>
                  {!isScanning ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={startScanner}
                      disabled={isLoading}
                      className="gap-2"
                    >
                      <Camera className="size-4" />
                      Scan QR Code
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={stopScanner}
                      className="gap-2"
                    >
                      <X className="size-4" />
                      Cancel Scan
                    </Button>
                  )}
                </div>
                <Input
                  id="url"
                  placeholder="http://example.com/id=xxx&passphrase=yyy-zzz"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading || isScanning}
                />
              </div>

              {isScanning && (
                <div className="space-y-2">
                  <div
                    id="qr-reader"
                    ref={scannerContainerRef}
                    className="w-full rounded-lg overflow-hidden border border-border"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Position the QR code within the frame to scan
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="passphrase">Passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                placeholder="word1-word2-word3"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading) {
                    handleDecryptWithPassphrase()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter the passphrase separated by dashes (e.g.,
                word1-word2-word3)
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          {!needsPassphrase ? (
            <Button
              onClick={handleLoad}
              disabled={isLoading || !url.trim() || isScanning}
            >
              {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Load
            </Button>
          ) : (
            <Button
              onClick={handleDecryptWithPassphrase}
              disabled={isLoading || !passphrase.trim()}
            >
              {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Decrypt & Load
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
