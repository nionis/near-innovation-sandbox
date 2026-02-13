import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Html5Qrcode } from 'html5-qrcode'
import { Scan, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  decryptMessages,
  extractTextRange,
  getPreviewText,
} from '@/lib/conversation-serializer'
import type {
  AttestationChatData,
  AttestationReceipt,
} from '@/stores/attestation-store'
import type { VerifyOutput } from '@repo/packages-attestations'

interface ScannedReference {
  shareId: string
  messageIndex: number
  startChar: number
  endChar: number
}

interface ReferenceContent {
  text: string
  messageIndex: number
  messageRole: string
  range: string
}

interface ScanReferenceDialogProps {
  isOpen: boolean
  onClose: () => void
  shareId?: string // The current conversation's share ID
  chatData?: AttestationChatData // The current conversation's chat data
  receipt?: AttestationReceipt // The current conversation's receipt
  verificationResult?: VerifyOutput // The current conversation's verification result
  onReferenceImported?: (reference: {
    shareId: string
    messageIndex: number
    startChar: number
    endChar: number
    previewText: string
  }) => void
}

export function ScanReferenceDialog({
  isOpen,
  onClose,
  shareId,
  chatData,
  receipt,
  verificationResult,
  onReferenceImported,
}: ScanReferenceDialogProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [referenceContent, setReferenceContent] =
    useState<ReferenceContent | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      stopScanning()
      setReferenceContent(null)
      setError(null)
      return
    }
  }, [isOpen])

  const startScanning = async () => {
    try {
      setError(null)
      setIsScanning(true)

      // Create scanner instance
      if (!scannerRef.current && videoContainerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader')
      }

      if (!scannerRef.current) {
        throw new Error('Failed to initialize QR scanner')
      }

      // Get camera devices
      const devices = await Html5Qrcode.getCameras()
      if (!devices || devices.length === 0) {
        throw new Error('No camera found on this device')
      }

      // Prefer back camera on mobile
      const backCamera =
        devices.find((device) => device.label.toLowerCase().includes('back')) ||
        devices[0]

      // Start scanning
      await scannerRef.current.start(
        backCamera.id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          console.log('QR Code scanned:', decodedText)
          await handleReferenceQRScanned(decodedText)
        },
        () => {
          // Ignore scan errors (happens frequently when no QR code is visible)
          // These are normal and expected - the scanner continuously tries to find QR codes
        }
      )
    } catch (err) {
      console.error('Error starting scanner:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to start QR scanner'
      )
      setIsScanning(false)
    }
  }

  const stopScanning = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
      }
      scannerRef.current = null
    } catch (err) {
      console.error('Error stopping scanner:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const parseReferenceQR = (qrText: string): ScannedReference | null => {
    try {
      // Format: shareId:messageIndex:startChar-endChar
      const parts = qrText.split(':')
      if (parts.length !== 3) {
        return null
      }

      const shareId = parts[0]
      const messageIndex = parseInt(parts[1], 10)
      const [startChar, endChar] = parts[2]
        .split('-')
        .map((n) => parseInt(n, 10))

      if (
        isNaN(messageIndex) ||
        isNaN(startChar) ||
        isNaN(endChar) ||
        !shareId
      ) {
        return null
      }

      return { shareId, messageIndex, startChar, endChar }
    } catch (err) {
      return null
    }
  }

  const handleReferenceQRScanned = async (qrText: string) => {
    // Stop scanning immediately after successful scan
    await stopScanning()
    setIsLoading(true)
    setError(null)

    try {
      // Check if we have the necessary data
      if (!shareId || !chatData || !receipt) {
        throw new Error(
          'No conversation data available. Please verify the conversation first.'
        )
      }

      // Parse the reference QR code
      const reference = parseReferenceQR(qrText)
      if (!reference) {
        throw new Error('Invalid reference QR code format')
      }

      // Verify the reference belongs to this conversation
      if (reference.shareId !== shareId) {
        throw new Error(
          'This reference QR code belongs to a different conversation'
        )
      }

      // Decrypt messages
      const messages = decryptMessages(chatData)

      console.log('Total messages:', messages.length)
      console.log('All messages:', messages)
      console.log('Reference:', reference)

      if (reference.messageIndex >= messages.length) {
        throw new Error(
          `Message index ${reference.messageIndex} out of range (total: ${messages.length})`
        )
      }

      const message = messages[reference.messageIndex]
      console.log('Target message:', message)
      console.log('Message content length:', message.content.length)
      console.log(
        'Extracting chars:',
        reference.startChar,
        '-',
        reference.endChar
      )

      const referencedText = extractTextRange(
        message.content,
        reference.startChar,
        reference.endChar
      )

      console.log('Referenced text:', referencedText)
      console.log('Referenced text length:', referencedText.length)

      setReferenceContent({
        text: referencedText,
        messageIndex: reference.messageIndex,
        messageRole: message.role,
        range: `${reference.startChar}-${reference.endChar}`,
      })

      // Call the callback to add the reference if provided
      if (onReferenceImported) {
        onReferenceImported({
          shareId: reference.shareId,
          messageIndex: reference.messageIndex,
          startChar: reference.startChar,
          endChar: reference.endChar,
          previewText: getPreviewText(referencedText),
        })
      }
    } catch (err) {
      console.error('Error processing reference QR code:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to process reference QR code'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    stopScanning()
    onClose()
  }

  // Check if conversation data is available
  const hasConversationData = Boolean(shareId && chatData && receipt)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="size-5" />
            Scan Reference QR Code
          </DialogTitle>
          <DialogDescription>
            Scan a reference QR code to view the specific text portion it
            references.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!hasConversationData && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertCircle className="size-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Please verify this conversation first to enable reference
                  scanning.
                </p>
              </div>
            </div>
          )}

          {hasConversationData && !referenceContent && (
            <div className="space-y-4">
              <div
                id="qr-reader"
                ref={videoContainerRef}
                className={cn(
                  'w-full rounded-lg overflow-hidden bg-muted',
                  isScanning ? 'min-h-[300px]' : 'hidden'
                )}
              />

              {!isScanning && (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
                  <Scan className="size-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground text-center">
                    Click the button below to start scanning
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex items-center justify-center gap-2 p-4">
                  <Loader2 className="size-5 animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    Processing QR code...
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {!isScanning ? (
                  <Button
                    onClick={startScanning}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <Scan className="size-4 mr-2" />
                    Start Scanning
                  </Button>
                ) : (
                  <Button
                    onClick={stopScanning}
                    variant="outline"
                    className="flex-1"
                  >
                    Stop Scanning
                  </Button>
                )}
                <Button onClick={handleClose} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* Referenced Content Display */}
          {referenceContent && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                  <span className="font-semibold uppercase">
                    {referenceContent.messageRole === 'user' && '👤 User'}
                    {referenceContent.messageRole === 'assistant' &&
                      '🤖 Assistant'}
                    {referenceContent.messageRole === 'system' && '⚙️ System'}
                  </span>
                  <span>•</span>
                  <span>Message #{referenceContent.messageIndex}</span>
                  <span>•</span>
                  <span>Chars {referenceContent.range}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap wrap-break-word p-3 bg-background rounded border">
                  {referenceContent.text}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setReferenceContent(null)
                    setError(null)
                  }}
                  className="flex-1"
                >
                  Scan Another
                </Button>
                <Button onClick={handleClose} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          )}

          {!hasConversationData && (
            <Button onClick={handleClose} variant="outline" className="w-full">
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
