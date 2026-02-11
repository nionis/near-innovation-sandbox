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
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Share2,
  Copy,
  Check,
  QrCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import {
  encryptString,
  uploadBinary,
  SHARE_API_URL as DEFAULT_SHARE_API_URL,
} from '@repo/packages-utils/share'
import { QRCodeSVG } from 'qrcode.react'

const SHARE_API_URL = IS_DEV ? 'http://localhost:3000' : DEFAULT_SHARE_API_URL

export function VerificationResultDialog() {
  const { verificationDialog, closeVerificationDialog, getMessageState } =
    useAttestationStore()
  const { isOpen, verificationResult, messageId } = verificationDialog
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)

  // Reset share state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShareUrl(null)
      setCopied(false)
      setIsSharing(false)
      setShowQRCode(false)
    }
  }, [isOpen])

  if (!verificationResult) return null

  const { result, chat, notorized, model_gpu, model_tdx, gateway_tdx } =
    verificationResult

  const checks = [
    {
      label: 'Chat Signature',
      valid: chat.valid,
      message: chat.message,
    },
    {
      label: 'Blockchain Record',
      valid: notorized.valid,
      message: notorized.message,
    },
    {
      label: 'Model GPU Attestation',
      valid: model_gpu.valid,
      message: model_gpu.message,
    },
    {
      label: 'Model TDX Attestation',
      valid: model_tdx.valid,
      message: model_tdx.message,
    },
    {
      label: 'Gateway TDX Attestation',
      valid: gateway_tdx.valid,
      message: gateway_tdx.message,
    },
  ]

  const handleShare = async () => {
    if (!messageId) return

    try {
      setIsSharing(true)
      setShareUrl(null)

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

      // Prepare the content to share - store ALL captured data
      const contentToShare = JSON.stringify({
        verificationResult,
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

  return (
    <Dialog open={isOpen} onOpenChange={closeVerificationDialog}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.valid ? (
              <>
                <CheckCircle2 className="size-6 text-green-500" />
                Proof Verified Successfully
              </>
            ) : (
              <>
                <AlertCircle className="size-6 text-yellow-500" />
                Proof Verification Completed with Issues
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
          {checks.map((check, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border',
                check.valid
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50'
                  : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50'
              )}
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
            </div>
          ))}
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
                <div className="flex flex-col items-center gap-2 w-full p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Scan QR Code to share:
                  </p>
                  <div className="bg-white p-4 rounded-lg">
                    <QRCodeSVG
                      value={shareUrl}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>
              )}
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
