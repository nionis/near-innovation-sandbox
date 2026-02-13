import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import { useAttestationStore } from '@/stores/attestation-store'
import type { ReferenceMetadata } from '@/stores/attestation-store'
import { useAttestation } from '@/hooks/useAttestation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  IconShieldCheck,
  IconLoader2,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react'
import {
  Share2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Scan,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { SelectableConversation } from '@/components/SelectableConversation'
import { ReferenceQR } from '@/components/ReferenceQR'
import { ScanReferenceDialog } from '@/components/ScanReferenceDialog'
import {
  encryptString,
  uploadBinary,
  SHARE_API_URL as DEFAULT_SHARE_API_URL,
} from '@repo/packages-utils/share'
import { getPreviewText } from '@/lib/conversation-serializer'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'

const SHARE_API_URL = IS_DEV ? 'http://localhost:3000' : DEFAULT_SHARE_API_URL

/** Verification check descriptions (mirrored from VerificationResultDialog) */
const CHECK_DESCRIPTIONS: Record<string, string> = {
  e2ee: 'End-to-end encryption ensures that your conversation is encrypted on your device and can only be decrypted by the intended recipient.',
  chat: 'Cryptographic signature verification ensures the chat messages have not been tampered with and were signed by the expected parties.',
  notorized:
    'The conversation record is notarized on the blockchain, providing an immutable proof of when the interaction occurred and its integrity.',
  model_gpu:
    "NVIDIA's Remote Attestation Service verifies that the GPU executing this model matches trusted hardware specifications.",
  model_tdx:
    'Intel TDX provides a hardware-isolated environment and issues cryptographically signed attestation reports for the model.',
  gateway_tdx:
    'Intel TDX attestation for the NEAR AI Cloud private LLM gateway where conversations are privately and securely stored.',
}

interface VerifyPanelProps {
  threadId: string
  chatMessages: UIMessage[]
}

export function VerifyPanel({
  threadId: _threadId,
  chatMessages,
}: VerifyPanelProps) {
  const { generateProof, verifyProof } = useAttestation()
  const messageStates = useAttestationStore((state) => state.messageStates)
  const getMessageState = useAttestationStore((state) => state.getMessageState)
  const addReferenceToMessage = useAttestationStore(
    (state) => state.addReferenceToMessage
  )
  const removeReferenceFromMessage = useAttestationStore(
    (state) => state.removeReferenceFromMessage
  )
  const updateReferencesShareId = useAttestationStore(
    (state) => state.updateReferencesShareId
  )
  const setStoreShareUrl = useAttestationStore((state) => state.setShareUrl)
  const getStoreShareUrl = useAttestationStore((state) => state.getShareUrl)

  const qrCodeRef = useRef<HTMLDivElement>(null)

  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showChecks, setShowChecks] = useState(false)
  const [expandedCheck, setExpandedCheck] = useState<number | null>(null)
  const [showConversation, setShowConversation] = useState(false)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [isVerifyingAll, setIsVerifyingAll] = useState(false)
  const [showScanDialog, setShowScanDialog] = useState(false)

  // Calculate attestation status for all assistant messages
  const attestationStatus = useMemo(() => {
    const assistantMessages = chatMessages.filter((m) => m.role === 'assistant')
    const total = assistantMessages.length

    let attested = 0
    let verified = 0
    let canAttest = 0
    let isProcessing = false

    assistantMessages.forEach((msg) => {
      const state = messageStates[msg.id]
      if (state?.receipt) attested++
      if (state?.verificationResult?.result.valid) verified++
      if (state?.chatData && !state?.receipt) canAttest++
      if (state?.isAttesting || state?.isVerifying) isProcessing = true
    })

    return {
      total,
      attested,
      verified,
      canAttest,
      isProcessing,
      assistantMessages,
    }
  }, [chatMessages, messageStates])

  console.log('attestationStatus', attestationStatus)

  // Find the latest assistant message with attestation data (for conversation display + references)
  const latestMessageWithChatData = useMemo(() => {
    return [...attestationStatus.assistantMessages].reverse().find((msg) => {
      const state = messageStates[msg.id]
      return !!state?.chatData
    })
  }, [attestationStatus.assistantMessages, messageStates])

  // Find the latest attested message (has receipt) for sharing
  const latestAttestedMessage = useMemo(() => {
    return [...attestationStatus.assistantMessages].reverse().find((msg) => {
      const state = messageStates[msg.id]
      return state?.chatData && state?.receipt
    })
  }, [attestationStatus.assistantMessages, messageStates])

  // The message we use for references & conversation display
  const activeMessageId = latestMessageWithChatData?.id
  const activeMessageState = activeMessageId
    ? messageStates[activeMessageId]
    : null

  // Get references for the active message
  const references = useMemo(() => {
    if (!activeMessageId) return []
    return messageStates[activeMessageId]?.references || []
  }, [activeMessageId, messageStates])

  // Extract shareId from shareUrl for scan dialog
  const shareId = useMemo(() => {
    if (!shareUrl) return undefined
    try {
      const url = new URL(shareUrl)
      return url.searchParams.get('id') || undefined
    } catch {
      return undefined
    }
  }, [shareUrl])

  // Check if any messages have chat data (NEAR AI)
  const hasAnyChatData = useMemo(() => {
    return attestationStatus.assistantMessages.some(
      (msg) => messageStates[msg.id]?.chatData
    )
  }, [attestationStatus.assistantMessages, messageStates])

  // Build verification checks from the latest verified message
  const verificationChecks = useMemo(() => {
    // Find latest message with verification result
    const verifiedMsg = [...attestationStatus.assistantMessages]
      .reverse()
      .find((msg) => messageStates[msg.id]?.verificationResult)

    if (!verifiedMsg) return null

    const vState = messageStates[verifiedMsg.id]
    const result = vState?.verificationResult
    if (!result) return null

    const isE2EE = !!vState?.chatData?.ephemeralPrivateKeys

    return [
      {
        label: 'End-to-End Encryption (E2EE)',
        valid: isE2EE,
        key: 'e2ee',
      },
      {
        label: 'Chat Signature',
        valid: result.chat.valid,
        message: result.chat.message,
        key: 'chat',
      },
      {
        label: 'Blockchain Record',
        valid: result.notorized.valid,
        message: result.notorized.message,
        key: 'notorized',
      },
      {
        label: 'Model GPU Attestation',
        valid: result.model_gpu.valid,
        message: result.model_gpu.message,
        key: 'model_gpu',
      },
      {
        label: 'Model TDX Attestation',
        valid: result.model_tdx.valid,
        message: result.model_tdx.message,
        key: 'model_tdx',
      },
      {
        label: 'Gateway TDX Attestation',
        valid: result.gateway_tdx.valid,
        message: result.gateway_tdx.message,
        key: 'gateway_tdx',
      },
    ]
  }, [attestationStatus.assistantMessages, messageStates])

  // Load cached share URL when latest attested message changes
  useEffect(() => {
    if (latestAttestedMessage) {
      const cached = getStoreShareUrl(latestAttestedMessage.id)
      if (cached) {
        setShareUrl(cached.url)
      } else {
        setShareUrl(null)
      }
    } else {
      setShareUrl(null)
    }
  }, [latestAttestedMessage, getStoreShareUrl])

  const handleGenerateAllProofs = useCallback(async () => {
    const unattested = attestationStatus.assistantMessages.filter((msg) => {
      const state = messageStates[msg.id]
      return state?.chatData && !state?.receipt
    })

    if (unattested.length === 0) return

    setIsGeneratingAll(true)
    try {
      for (const msg of unattested) {
        await generateProof(msg.id)
      }
      toast.success(
        `Generated proofs for ${unattested.length} message${unattested.length > 1 ? 's' : ''}`
      )
    } catch (error) {
      console.error('Failed to generate all proofs:', error)
    } finally {
      setIsGeneratingAll(false)
    }
  }, [attestationStatus.assistantMessages, messageStates, generateProof])

  const handleVerifyAll = useCallback(
    async (skipCache = false) => {
      const attested = attestationStatus.assistantMessages.filter((msg) => {
        const state = messageStates[msg.id]
        return state?.receipt
      })

      if (attested.length === 0) return

      setIsVerifyingAll(true)
      try {
        let allValid = true
        for (const msg of attested) {
          const result = await verifyProof(msg.id, {
            silent: true,
            skipCache,
          })
          if (!result?.result.valid) allValid = false
        }

        if (allValid) {
          toast.success('All proofs verified successfully!')
        } else {
          toast.warning(
            'Some verifications had issues. Check individual messages.'
          )
        }
      } catch (error) {
        console.error('Failed to verify all:', error)
      } finally {
        setIsVerifyingAll(false)
      }
    },
    [attestationStatus.assistantMessages, messageStates, verifyProof]
  )

  const handleShare = useCallback(async () => {
    if (!latestAttestedMessage) return

    try {
      setIsSharing(true)
      const msgState = getMessageState(latestAttestedMessage.id)
      if (!msgState?.receipt || !msgState?.chatData) {
        throw new Error('Missing receipt or chat data')
      }

      const { receipt, chatData } = msgState
      if (!chatData.ourPassphrase || chatData.ourPassphrase.length === 0) {
        throw new Error('Missing passphrase in chat data')
      }

      const passphrase = chatData.ourPassphrase

      // Create content hash for caching
      const contentForHash = JSON.stringify({ chatData, receipt })
      const encoder = new TextEncoder()
      const data = encoder.encode(contentForHash)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const contentHash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      // Check cache
      const cachedShare = getStoreShareUrl(latestAttestedMessage.id)
      if (cachedShare && cachedShare.hash === contentHash) {
        setShareUrl(cachedShare.url)
        // Update any pending references with the shareId
        const url = new URL(cachedShare.url)
        const shareId = url.searchParams.get('id')
        if (shareId && activeMessageId) {
          updateReferencesShareId(activeMessageId, shareId)
        }
        setIsSharing(false)
        return
      }

      // Encrypt and upload
      const contentToShare = JSON.stringify({
        chatData,
        receipt,
        timestamp: Date.now(),
      })

      const encryptedBinary = encryptString(contentToShare, passphrase)
      const { id } = await uploadBinary(SHARE_API_URL, {
        requestHash: receipt.requestHash,
        responseHash: receipt.responseHash,
        signature: receipt.signature,
        binary: encryptedBinary,
      })

      const url = `${SHARE_API_URL}/?id=${id}&passphrase=${chatData.ourPassphrase.join('-')}`
      setStoreShareUrl(latestAttestedMessage.id, url, contentHash)
      setShareUrl(url)

      // Update any pending references with the new shareId
      if (activeMessageId) {
        updateReferencesShareId(activeMessageId, id)
      }

      toast.success('Share URL generated!')
    } catch (error) {
      console.error('Failed to share:', error)
      toast.error('Failed to share. Please try again.')
    } finally {
      setIsSharing(false)
    }
  }, [
    latestAttestedMessage,
    activeMessageId,
    getMessageState,
    getStoreShareUrl,
    setStoreShareUrl,
    updateReferencesShareId,
  ])

  const handleCopyUrl = useCallback(async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareUrl])

  const handleDownloadQR = useCallback(async () => {
    if (!qrCodeRef.current || !shareUrl) return

    try {
      const svgElement = qrCodeRef.current.querySelector('svg')
      if (!svgElement) {
        console.error('SVG element not found')
        return
      }

      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement
      const svgWidth = clonedSvg.width.baseVal.value || 200
      const svgHeight = clonedSvg.height.baseVal.value || 200

      const padding = 32
      const canvas = document.createElement('canvas')
      canvas.width = svgWidth + padding * 2
      canvas.height = svgHeight + padding * 2

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.error('Canvas context not available')
        return
      }

      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const svgString = new XMLSerializer().serializeToString(clonedSvg)
      const svgBlob = new Blob([svgString], {
        type: 'image/svg+xml;charset=utf-8',
      })

      const img = new Image()
      const url = URL.createObjectURL(svgBlob)

      img.onload = async () => {
        try {
          ctx.drawImage(img, padding, padding, svgWidth, svgHeight)
          URL.revokeObjectURL(url)

          canvas.toBlob(
            async (blob) => {
              if (!blob) {
                console.error('Failed to create blob from canvas')
                return
              }

              try {
                const arrayBuffer = await blob.arrayBuffer()
                const bytes = new Uint8Array(arrayBuffer)
                let binary = ''
                for (let i = 0; i < bytes.length; i++) {
                  binary += String.fromCharCode(bytes[i])
                }
                const base64Data = btoa(binary)

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

                if (!savePath) return

                await invoke('write_binary_file', {
                  path: savePath,
                  base64Data: base64Data,
                })

                toast.success('QR code saved successfully!')
              } catch (error) {
                console.error('Error saving QR code:', error)
                toast.error('Failed to save QR code. Please try again.')
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
      toast.error('Failed to download QR code. Please try again.')
    }
  }, [shareUrl])

  // Reference creation - works with or without a share URL
  const handleTextSelected = useCallback(
    (
      messageIndex: number,
      startChar: number,
      endChar: number,
      selectedText: string
    ) => {
      if (!activeMessageId) return

      // Extract shareId from URL if available, otherwise use empty string
      let shareId = ''
      if (shareUrl) {
        try {
          const url = new URL(shareUrl)
          shareId = url.searchParams.get('id') || ''
        } catch {
          // ignore URL parse errors
        }
      }

      const reference: ReferenceMetadata = {
        id: crypto.randomUUID(),
        shareId,
        messageIndex,
        startChar,
        endChar,
        previewText: getPreviewText(selectedText),
        createdAt: Date.now(),
      }

      addReferenceToMessage(activeMessageId, reference)
    },
    [activeMessageId, shareUrl, addReferenceToMessage]
  )

  const handleRemoveReference = useCallback(
    (referenceId: string) => {
      if (!activeMessageId) return
      removeReferenceFromMessage(activeMessageId, referenceId)
    },
    [activeMessageId, removeReferenceFromMessage]
  )

  const handleReferenceImported = useCallback(
    (importedRef: {
      shareId: string
      messageIndex: number
      startChar: number
      endChar: number
      previewText: string
    }) => {
      if (!activeMessageId) return

      // Check if this reference already exists (same message index and range)
      const isDuplicate = references.some(
        (ref) =>
          ref.messageIndex === importedRef.messageIndex &&
          ref.startChar === importedRef.startChar &&
          ref.endChar === importedRef.endChar
      )

      if (isDuplicate) {
        toast.info('This reference already exists')
        return
      }

      // Create and add the new reference
      const reference: ReferenceMetadata = {
        id: crypto.randomUUID(),
        shareId: importedRef.shareId,
        messageIndex: importedRef.messageIndex,
        startChar: importedRef.startChar,
        endChar: importedRef.endChar,
        previewText: importedRef.previewText,
        createdAt: Date.now(),
      }

      addReferenceToMessage(activeMessageId, reference)
      toast.success('Reference imported successfully!')
    },
    [activeMessageId, references, addReferenceToMessage]
  )

  const handleDownloadReference = useCallback(
    async (reference: ReferenceMetadata) => {
      if (!reference.shareId) return

      try {
        const qrValue = `${reference.shareId}:${reference.messageIndex}:${reference.startChar}-${reference.endChar}`

        const QRCode = (await import('qrcode')).default
        const qrDataUrl = await QRCode.toDataURL(qrValue, {
          width: 80,
          margin: 1,
          errorCorrectionLevel: 'M',
        })

        const response = await fetch(qrDataUrl)
        const blob = await response.blob()

        const arrayBuffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64Data = btoa(binary)

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

        if (!savePath) return

        await invoke('write_binary_file', {
          path: savePath,
          base64Data: base64Data,
        })

        toast.success('Reference QR code saved successfully!')
      } catch (error) {
        console.error('Error downloading reference QR code:', error)
        toast.error('Failed to download reference QR code. Please try again.')
      }
    },
    []
  )

  const allVerified =
    attestationStatus.verified === attestationStatus.total &&
    attestationStatus.total > 0
  const hasAttestations = attestationStatus.attested > 0
  const canShare = hasAttestations && !!latestAttestedMessage
  const isBusy =
    attestationStatus.isProcessing || isGeneratingAll || isVerifyingAll

  // --- Empty state: no assistant messages ---
  if (attestationStatus.total === 0) {
    return (
      <div className="border rounded-2xl bg-background px-4 py-6 text-center">
        <IconShieldCheck
          size={24}
          className="mx-auto mb-2 text-muted-foreground"
        />
        <p className="text-sm text-muted-foreground">
          Start a conversation to enable verification and sharing.
        </p>
      </div>
    )
  }

  // --- Empty state: no NEAR AI attestation data ---
  if (!hasAnyChatData && !hasAttestations) {
    return (
      <div className="border rounded-2xl bg-background px-4 py-6 text-center">
        <AlertCircle size={24} className="mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No attestation data available.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Use the <span className="font-medium">NEAR AI</span> provider to
          enable verifiable conversations.
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-2xl bg-background overflow-y-auto flex-1 min-h-0">
      {/* Status bar */}
      <div className="px-4 py-3 flex items-center justify-between border-b bg-muted/20">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              'size-2.5 rounded-full shrink-0',
              allVerified
                ? 'bg-green-500'
                : hasAttestations
                  ? 'bg-blue-500'
                  : attestationStatus.canAttest > 0
                    ? 'bg-amber-500'
                    : 'bg-muted-foreground/30'
            )}
          />
          <span className="text-sm min-w-0 flex items-center gap-2">
            {allVerified ? (
              <>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  All messages verified
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleVerifyAll(true)}
                  disabled={isBusy}
                  className="h-6 px-2 text-xs"
                >
                  {isVerifyingAll ? (
                    <IconLoader2 size={12} className="mr-1 animate-spin" />
                  ) : null}
                  Verify Again
                </Button>
              </>
            ) : (
              <span className="flex flex-wrap items-center gap-x-1">
                <span className="font-medium">
                  {attestationStatus.total} message
                  {attestationStatus.total !== 1 ? 's' : ''}
                </span>
                <span className="text-muted-foreground">
                  {attestationStatus.attested > 0 &&
                    ` · ${attestationStatus.attested} attested`}
                  {attestationStatus.verified > 0 &&
                    ` · ${attestationStatus.verified} verified`}
                  {attestationStatus.canAttest > 0 &&
                    ` · ${attestationStatus.canAttest} pending`}
                </span>
              </span>
            )}
          </span>
        </div>
        {isBusy && (
          <IconLoader2
            size={16}
            className="animate-spin text-muted-foreground shrink-0"
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-2">
        {/* Generate Proofs */}
        {attestationStatus.canAttest > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateAllProofs}
            disabled={isBusy}
          >
            {isGeneratingAll ? (
              <IconLoader2 size={14} className="mr-1.5 animate-spin" />
            ) : (
              <IconShieldCheck size={14} className="mr-1.5" />
            )}
            {isGeneratingAll
              ? 'Generating...'
              : `Generate ${attestationStatus.canAttest > 1 ? `${attestationStatus.canAttest} Proofs` : 'Proof'}`}
          </Button>
        )}

        {/* Verify */}
        {attestationStatus.attested > 0 &&
          attestationStatus.verified < attestationStatus.attested && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleVerifyAll}
              disabled={isBusy}
            >
              {isVerifyingAll ? (
                <IconLoader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <IconShieldCheck size={14} className="mr-1.5" />
              )}
              {isVerifyingAll
                ? 'Verifying...'
                : `Verify${attestationStatus.attested > 1 ? ' All' : ''}`}
            </Button>
          )}

        {/* Share */}
        {canShare && !shareUrl && (
          <Button
            size="sm"
            onClick={handleShare}
            disabled={isBusy || isSharing}
          >
            {isSharing ? (
              <IconLoader2 size={14} className="mr-1.5 animate-spin" />
            ) : (
              <Share2 size={14} className="mr-1.5" />
            )}
            {isSharing ? 'Sharing...' : 'Share Conversation'}
          </Button>
        )}

        {/* Copy URL */}
        {shareUrl && (
          <Button size="sm" variant="outline" onClick={handleCopyUrl}>
            {copied ? (
              <IconCheck size={14} className="mr-1.5" />
            ) : (
              <IconCopy size={14} className="mr-1.5" />
            )}
            {copied ? 'Copied!' : 'Copy URL'}
          </Button>
        )}

        {/* Scan Reference */}
        {activeMessageState &&
          activeMessageState.receipt &&
          activeMessageState?.shareUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowScanDialog(true)}
              disabled={isBusy}
            >
              <Scan size={14} className="mr-1.5" />
              Scan Reference
            </Button>
          )}
      </div>

      {/* Verification checks (collapsible) */}
      {verificationChecks && (
        <div className="border-t">
          <button
            onClick={() => setShowChecks(!showChecks)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-xs font-medium text-muted-foreground">
              Verification Details (
              {verificationChecks.filter((c) => c.valid).length}/
              {verificationChecks.length} passed)
            </span>
            {showChecks ? (
              <IconChevronUp size={14} className="text-muted-foreground" />
            ) : (
              <IconChevronDown size={14} className="text-muted-foreground" />
            )}
          </button>
          {showChecks && (
            <div className="px-4 pb-3 space-y-1.5">
              {verificationChecks.map((check, i) => (
                <div key={check.key}>
                  <button
                    onClick={() =>
                      setExpandedCheck(expandedCheck === i ? null : i)
                    }
                    className="w-full flex items-center gap-2 py-1 text-left hover:opacity-80"
                  >
                    {check.valid ? (
                      <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="size-3.5 text-red-500 shrink-0" />
                    )}
                    <span
                      className={cn(
                        'text-xs',
                        check.valid
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300'
                      )}
                    >
                      {check.label}
                    </span>
                  </button>
                  {expandedCheck === i && (
                    <div className="ml-5.5 pl-1 text-[11px] text-muted-foreground pb-1.5">
                      {CHECK_DESCRIPTIONS[check.key]}
                      {check.message && (
                        <p className="mt-0.5 opacity-75">{check.message}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Share URL + QR Code */}
      {shareUrl && (
        <div className="px-4 py-3 border-t">
          <div className="flex gap-4 items-start">
            {/* QR Code */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div
                ref={qrCodeRef}
                className="bg-white p-2 rounded-lg shadow-sm"
              >
                <QRCodeSVG
                  value={shareUrl}
                  size={100}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadQR}
                className="flex items-center gap-1.5 text-xs h-7 px-2"
              >
                <Download className="size-3" />
                Save QR
              </Button>
            </div>
            {/* URL + copy */}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Share URL
              </p>
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/50 rounded-md cursor-pointer hover:bg-muted transition-colors"
                onClick={handleCopyUrl}
                title="Click to copy"
              >
                <p className="text-xs font-mono truncate w-0 flex-1 text-muted-foreground">
                  {shareUrl}
                </p>
                {copied ? (
                  <IconCheck size={12} className="text-green-500 shrink-0" />
                ) : (
                  <IconCopy
                    size={12}
                    className="text-muted-foreground shrink-0"
                  />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Scan or share this URL to let others verify this conversation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* References section - available whenever chatData exists */}
      {activeMessageState?.chatData && (
        <div className="border-t">
          <button
            onClick={() => setShowConversation(!showConversation)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-xs font-medium text-muted-foreground">
              References{references.length > 0 ? ` (${references.length})` : ''}{' '}
              — Select text to create references
            </span>
            {showConversation ? (
              <IconChevronUp size={14} className="text-muted-foreground" />
            ) : (
              <IconChevronDown size={14} className="text-muted-foreground" />
            )}
          </button>

          {showConversation && (
            <div className="px-4 pb-3">
              {!shareUrl && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                  References can be created now. Share the conversation to
                  generate QR codes.
                </p>
              )}
              <SelectableConversation
                chatData={activeMessageState.chatData}
                onTextSelected={handleTextSelected}
              />
            </div>
          )}

          {/* References list */}
          {references.length > 0 && (
            <div className="px-4 pb-3 space-y-2">
              {!showConversation && <div className="h-px bg-border" />}
              {references.map((ref) => (
                <ReferenceQR
                  key={ref.id}
                  reference={ref}
                  onDownload={() => handleDownloadReference(ref)}
                  onDelete={() => handleRemoveReference(ref.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scan Reference Dialog */}
      <ScanReferenceDialog
        isOpen={showScanDialog}
        onClose={() => setShowScanDialog(false)}
        shareId={shareId}
        chatData={activeMessageState?.chatData}
        receipt={activeMessageState?.receipt}
        verificationResult={activeMessageState?.verificationResult}
        onReferenceImported={handleReferenceImported}
      />
    </div>
  )
}
