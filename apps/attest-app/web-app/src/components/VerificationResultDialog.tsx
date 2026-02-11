import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAttestationStore } from '@/stores/attestation-store'
import type { ReferenceMetadata } from '@/stores/attestation-store'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Share2,
  Copy,
  Check,
  QrCode,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import {
  encryptString,
  uploadBinary,
  SHARE_API_URL as DEFAULT_SHARE_API_URL,
} from '@repo/packages-utils/share'
import { QRCodeSVG } from 'qrcode.react'
import { invoke } from '@tauri-apps/api/core'
import { SelectableConversation } from './SelectableConversation'
import { ReferenceQR } from './ReferenceQR'
import { getPreviewText } from '@/lib/conversation-serializer'

const SHARE_API_URL = IS_DEV ? 'http://localhost:3000' : DEFAULT_SHARE_API_URL

export function VerificationResultDialog() {
  const {
    verificationDialog,
    closeVerificationDialog,
    getMessageState,
    addReference,
    removeReference,
    setShareUrl: setStoreShareUrl,
    getShareUrl: getStoreShareUrl,
  } = useAttestationStore()
  const { isOpen, verificationResult, messageId, references } =
    verificationDialog
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  const [expandedChecks, setExpandedChecks] = useState<Set<number>>(new Set())
  const qrCodeRef = useRef<HTMLDivElement>(null)

  // Reset share state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShareUrl(null)
      setCopied(false)
      setIsSharing(false)
      setShowQRCode(false)
      setExpandedChecks(new Set())
    } else if (messageId) {
      // Load cached share URL if available
      const cachedShare = getStoreShareUrl(messageId)
      if (cachedShare) {
        setShareUrl(cachedShare.url)
      }
    }
  }, [isOpen, messageId, getStoreShareUrl])

  if (!verificationResult) return null

  const { result, chat, notorized, model_gpu, model_tdx, gateway_tdx } =
    verificationResult

  // Check if E2EE was used
  const messageState = messageId ? getMessageState(messageId) : null
  const isE2EE = !!messageState?.chatData?.ephemeralPrivateKeys

  const checks = [
    {
      label: 'End-to-End Encryption (E2EE)',
      valid: isE2EE,
      message: '',
      description:
        'End-to-end encryption ensures that your conversation is encrypted on your device and can only be decrypted by the intended recipient. This prevents any intermediate servers or network observers from reading the message contents.',
    },
    {
      label: 'Chat Signature',
      valid: chat.valid,
      message: chat.message,
      description:
        'Cryptographic signature verification ensures the chat messages have not been tampered with and were signed by the expected parties.',
    },
    {
      label: 'Blockchain Record',
      valid: notorized.valid,
      message: notorized.message,
      description:
        'The conversation record is notarized on the blockchain, providing an immutable proof of when the interaction occurred and its integrity.',
    },
    {
      label: 'Model GPU Attestation',
      valid: model_gpu.valid,
      message: model_gpu.message,
      description:
        "NVIDIA's Remote Attestation Service verifies that the GPU executing this model matches trusted hardware specifications. This confirms the model is running on authentic hardware.",
    },
    {
      label: 'Model TDX Attestation',
      valid: model_tdx.valid,
      message: model_tdx.message,
      description:
        'Intel TDX (Trust Domain Extensions) provides a hardware-isolated environment and issues cryptographically signed attestation reports. This ensures the model runs in a secure, isolated trusted execution environment.',
    },
    {
      label: 'Gateway TDX Attestation',
      valid: gateway_tdx.valid,
      message: gateway_tdx.message,
      description:
        'Intel TDX attestation for the NEAR AI Cloud private LLM gateway environment where your conversations are privately and securely stored. This confirms the gateway infrastructure operates in a trusted, hardware-isolated environment.',
    },
  ]

  const toggleCheckExpanded = (index: number) => {
    setExpandedChecks((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const handleShare = async () => {
    if (!messageId) return

    try {
      setIsSharing(true)

      // Get the message state to retrieve receipt and chat data
      const messageState = getMessageState(messageId)
      if (!messageState?.receipt || !messageState?.chatData) {
        throw new Error('Missing receipt or chat data')
      }

      const { receipt, chatData } = messageState

      // Use the passphrase from the captured data (used for E2EE)
      if (!chatData.ourPassphrase || chatData.ourPassphrase.length === 0) {
        throw new Error('Missing passphrase in chat data')
      }
      const passphrase = chatData.ourPassphrase

      // Prepare the content to share - store ALL captured data (excluding timestamp for hash)
      const contentForHash = JSON.stringify({
        verificationResult,
        chatData,
        receipt,
      })

      // Create a hash of the content to detect changes
      const encoder = new TextEncoder()
      const data = encoder.encode(contentForHash)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const contentHash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      // Check if we have a cached share URL with matching content
      const cachedShare = getStoreShareUrl(messageId)
      if (cachedShare && cachedShare.hash === contentHash) {
        // Content hasn't changed, reuse the existing URL
        setShareUrl(cachedShare.url)
        setIsSharing(false)
        return
      }

      // Content changed or no cache exists, generate new share URL
      const contentToShare = JSON.stringify({
        chatData,
        receipt,
        timestamp: Date.now(),
      })

      // Encrypt the content using the original passphrase
      const encryptedBinary = encryptString(contentToShare, passphrase)

      // Upload the encrypted binary
      const { id } = await uploadBinary(SHARE_API_URL, {
        requestHash: receipt.requestHash,
        responseHash: receipt.responseHash,
        signature: receipt.signature,
        binary: encryptedBinary,
      })

      // Generate the share URL
      const url = `${SHARE_API_URL}/?id=${id}&passphrase=${chatData.ourPassphrase.join(
        '-'
      )}`

      // Store the URL and hash in the store
      setStoreShareUrl(messageId, url, contentHash)
      setShareUrl(url)
    } catch (error) {
      console.error('Failed to share:', error)
      alert('Failed to share verification result. Please try again.')
    } finally {
      setIsSharing(false)
    }
  }

  const handleCopyUrl = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadQR = async () => {
    if (!qrCodeRef.current || !shareUrl) return

    try {
      // Get the SVG element
      const svgElement = qrCodeRef.current.querySelector('svg')
      if (!svgElement) {
        console.error('SVG element not found')
        return
      }

      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement

      // Ensure SVG has proper dimensions
      const svgWidth = clonedSvg.width.baseVal.value || 200
      const svgHeight = clonedSvg.height.baseVal.value || 200

      // Create canvas with padding
      const padding = 32
      const canvas = document.createElement('canvas')
      canvas.width = svgWidth + padding * 2
      canvas.height = svgHeight + padding * 2

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.error('Canvas context not available')
        return
      }

      // Fill white background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Serialize SVG to string
      const svgString = new XMLSerializer().serializeToString(clonedSvg)
      const svgBlob = new Blob([svgString], {
        type: 'image/svg+xml;charset=utf-8',
      })

      // Create image from SVG
      const img = new Image()
      const url = URL.createObjectURL(svgBlob)

      img.onload = async () => {
        try {
          // Draw the SVG image onto canvas
          ctx.drawImage(img, padding, padding, svgWidth, svgHeight)

          // Clean up blob URL
          URL.revokeObjectURL(url)

          // Convert canvas to blob
          canvas.toBlob(
            async (blob) => {
              if (!blob) {
                console.error('Failed to create blob from canvas')
                return
              }

              try {
                // Convert blob to base64
                const arrayBuffer = await blob.arrayBuffer()
                const bytes = new Uint8Array(arrayBuffer)
                let binary = ''
                for (let i = 0; i < bytes.length; i++) {
                  binary += String.fromCharCode(bytes[i])
                }
                const base64Data = btoa(binary)

                // Open save dialog
                const savePath = await invoke<string | null>('save_dialog', {
                  options: {
                    defaultPath: `verification-qr-${Date.now()}.png`,
                    filters: [
                      {
                        name: 'PNG Image',
                        extensions: ['png'],
                      },
                    ],
                  },
                })

                if (!savePath) {
                  // User cancelled the dialog
                  return
                }

                // Write the binary file
                await invoke('write_binary_file', {
                  path: savePath,
                  base64Data: base64Data,
                })

                console.log('QR code saved successfully to:', savePath)
              } catch (error) {
                console.error('Error saving QR code:', error)
                alert('Failed to save QR code. Please try again.')
              }
            },
            'image/png',
            1.0
          )
        } catch (error) {
          console.error('Error processing QR code:', error)
          URL.revokeObjectURL(url)
        }
      }

      img.onerror = (error) => {
        console.error('Failed to load SVG image:', error)
        URL.revokeObjectURL(url)
      }

      img.src = url
    } catch (error) {
      console.error('Error downloading QR code:', error)
      alert('Failed to download QR code. Please try again.')
    }
  }

  const handleTextSelected = (
    messageIndex: number,
    startChar: number,
    endChar: number,
    selectedText: string
  ) => {
    if (!messageId || !shareUrl) return

    // Extract share ID from URL
    const url = new URL(shareUrl)
    const shareId = url.searchParams.get('id')
    if (!shareId) return

    const reference: ReferenceMetadata = {
      id: crypto.randomUUID(),
      shareId,
      messageIndex,
      startChar,
      endChar,
      previewText: getPreviewText(selectedText),
      createdAt: Date.now(),
    }

    addReference(reference)
  }

  const handleDownloadReference = async (reference: ReferenceMetadata) => {
    try {
      const qrValue = `${reference.shareId}:${reference.messageIndex}:${reference.startChar}-${reference.endChar}`

      // Use QRCode library to generate
      const QRCode = (await import('qrcode')).default
      const qrDataUrl = await QRCode.toDataURL(qrValue, {
        width: 80,
        margin: 1,
        errorCorrectionLevel: 'M',
      })

      // Convert data URL to blob
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()

      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64Data = btoa(binary)

      // Open save dialog
      const savePath = await invoke<string | null>('save_dialog', {
        options: {
          defaultPath: `reference-${reference.id.slice(0, 8)}-${Date.now()}.png`,
          filters: [
            {
              name: 'PNG Image',
              extensions: ['png'],
            },
          ],
        },
      })

      if (!savePath) {
        // User cancelled the dialog
        return
      }

      // Write the binary file
      await invoke('write_binary_file', {
        path: savePath,
        base64Data: base64Data,
      })

      console.log('Reference QR code saved successfully to:', savePath)
    } catch (error) {
      console.error('Error downloading reference QR code:', error)
      alert('Failed to download reference QR code. Please try again.')
    }
  }

  const handleDownloadAllReferences = async () => {
    if (references.length === 0) return

    try {
      const JSZip = (await import('jszip')).default
      const QRCode = (await import('qrcode')).default
      const zip = new JSZip()

      // Generate QR codes for all references
      for (const ref of references) {
        const qrValue = `${ref.shareId}:${ref.messageIndex}:${ref.startChar}-${ref.endChar}`
        const qrDataUrl = await QRCode.toDataURL(qrValue, {
          width: 80,
          margin: 1,
          errorCorrectionLevel: 'M',
        })

        // Convert data URL to blob
        const response = await fetch(qrDataUrl)
        const blob = await response.blob()

        // Add to zip
        zip.file(`reference-${ref.id.slice(0, 8)}.png`, blob)
      }

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' })

      // Convert blob to base64
      const arrayBuffer = await zipBlob.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64Data = btoa(binary)

      // Open save dialog
      const savePath = await invoke<string | null>('save_dialog', {
        options: {
          defaultPath: `references-${Date.now()}.zip`,
          filters: [
            {
              name: 'ZIP Archive',
              extensions: ['zip'],
            },
          ],
        },
      })

      if (!savePath) {
        // User cancelled the dialog
        return
      }

      // Write the binary file
      await invoke('write_binary_file', {
        path: savePath,
        base64Data: base64Data,
      })

      console.log('All references saved successfully to:', savePath)
    } catch (error) {
      console.error('Error downloading all references:', error)
      alert('Failed to download all references. Please try again.')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={closeVerificationDialog}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.valid ? (
              <>
                <CheckCircle2 className="size-6 text-green-500" />
                Chat Verified Successfully
              </>
            ) : (
              <>
                <AlertCircle className="size-6 text-yellow-500" />
                Chat Verification Completed with Issues
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {result.valid
              ? 'All verification checks passed successfully.'
              : 'Some verification checks did not pass. See details below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {checks.map((check, index) => {
            const isExpanded = expandedChecks.has(index)
            return (
              <div
                key={index}
                className={cn(
                  'rounded-lg border',
                  check.valid
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50'
                    : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50'
                )}
              >
                <button
                  onClick={() => toggleCheckExpanded(index)}
                  className="w-full flex items-start gap-3 p-3 text-left hover:opacity-80 transition-opacity"
                >
                  {check.valid ? (
                    <CheckCircle2 className="size-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        check.valid
                          ? 'text-green-900 dark:text-green-100'
                          : 'text-red-900 dark:text-red-100'
                      )}
                    >
                      {check.label}
                    </p>
                    {check.message && (
                      <p
                        className={cn(
                          'text-xs mt-1',
                          check.valid
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-red-700 dark:text-red-300'
                        )}
                      >
                        {check.message}
                      </p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="size-4 text-gray-500 shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="size-4 text-gray-500 shrink-0 mt-0.5" />
                  )}
                </button>
                {isExpanded && check.description && (
                  <div
                    className={cn(
                      'px-3 pb-3 pt-0 text-xs border-t',
                      check.valid
                        ? 'text-green-800 dark:text-green-200 border-green-200 dark:border-green-900/50'
                        : 'text-red-800 dark:text-red-200 border-red-200 dark:border-red-900/50'
                    )}
                  >
                    <p className="mt-2">{check.description}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-col">
          {shareUrl && (
            <div className="w-full space-y-3">
              <div className="flex items-center gap-2 w-full p-3 bg-muted rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">
                    Share URL:
                  </p>
                  <p className="text-sm font-mono break-all">{shareUrl}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQRCode(!showQRCode)}
                  className="shrink-0"
                >
                  <QrCode className="size-4" />
                </Button>
              </div>

              {showQRCode && (
                <div className="flex flex-col items-center gap-3 w-full p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Scan QR Code to share:
                  </p>
                  <div ref={qrCodeRef} className="bg-white p-4 rounded-lg">
                    <QRCodeSVG
                      value={shareUrl}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadQR}
                    className="flex items-center gap-2"
                  >
                    <Download className="size-4" />
                    Download
                  </Button>
                </div>
              )}

              {/* Reference QR Codes Section */}
              <div className="w-full space-y-3 border-t pt-3 mt-3">
                <h3 className="text-sm font-medium">
                  Create Reference QR Codes
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select text from the conversation below to create reference QR
                  codes that link to specific parts of this verified
                  conversation.
                </p>

                {/* Selectable Conversation Display */}
                {messageState?.chatData && (
                  <SelectableConversation
                    chatData={messageState.chatData}
                    onTextSelected={handleTextSelected}
                  />
                )}

                {/* Generated References List */}
                {references.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">
                        Generated References ({references.length})
                      </h4>
                      {references.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDownloadAllReferences}
                        >
                          <Download className="size-4 mr-2" />
                          Download All (ZIP)
                        </Button>
                      )}
                    </div>
                    {references.map((ref) => (
                      <ReferenceQR
                        key={ref.id}
                        reference={ref}
                        onDownload={() => handleDownloadReference(ref)}
                        onDelete={() => removeReference(ref.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 w-full">
            {result.valid && !shareUrl && (
              <Button
                onClick={handleShare}
                disabled={isSharing}
                variant="outline"
                className="flex-1 sm:flex-initial"
              >
                <Share2 className="size-4 mr-2" />
                {isSharing ? 'Sharing...' : 'Share'}
              </Button>
            )}
            <Button
              onClick={closeVerificationDialog}
              className={cn(
                'flex-1 sm:flex-initial',
                !result.valid || shareUrl ? 'w-full' : ''
              )}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
