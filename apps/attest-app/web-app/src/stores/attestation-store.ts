import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VerifyOutput } from '@repo/packages-attestations'

/**
 * Chat data required for attestation
 * Includes all captured E2EE data from the near.ai provider
 */
export interface AttestationChatData {
  id: string
  requestBody: string
  responseBody: string
  output: string
  // E2EE captured data
  ourPassphrase: string[]
  modelsPublicKey?: string
  ephemeralPrivateKeys?: string[]
}

/**
 * Receipt returned from attestation
 */
export interface AttestationReceipt {
  requestHash: string
  responseHash: string
  signature: string
  signingAddress: string
  signingAlgo: string
  proofHash: string
  timestamp: number
  txHash: string
}

/**
 * Reference metadata for QR code references
 */
export interface ReferenceMetadata {
  id: string // unique reference ID (uuid)
  shareId: string // the master share ID from upload
  messageIndex: number // index of the message in the conversation
  startChar: number // start position within the message content
  endChar: number // end position within the message content
  previewText: string // first 50 chars for UI preview
  createdAt: number // timestamp
}

/**
 * Attestation state for a single message
 */
export interface MessageAttestationState {
  chatData?: AttestationChatData
  receipt?: AttestationReceipt
  verificationResult?: VerifyOutput
  verificationCacheKey?: string // Cache key to detect if verification inputs changed
  isAttesting: boolean
  isVerifying: boolean
  error?: string
  verificationError?: string
  shareUrl?: string // Cached share URL to avoid regenerating
  shareContentHash?: string // Hash of content to detect changes
  references: ReferenceMetadata[] // References for this message
}

interface AttestationSettings {
  attestationApiUrl: string
}

interface VerificationDialogState {
  isOpen: boolean
  messageId: string | null
  verificationResult: VerifyOutput | null
  references: ReferenceMetadata[]
}

interface AttestationState {
  // Settings
  settings: AttestationSettings

  // Per-message attestation state (keyed by message ID)
  messageStates: Record<string, MessageAttestationState>

  // Pending chat data waiting to be assigned to a message ID
  pendingChatData: AttestationChatData | null

  // Verification dialog state
  verificationDialog: VerificationDialogState

  // Actions
  setAttestationApiUrl: (url: string) => void
  setChatData: (messageId: string, chatData: AttestationChatData) => void
  getChatData: (messageId: string) => AttestationChatData | undefined
  setPendingChatData: (chatData: AttestationChatData | null) => void
  getPendingChatData: () => AttestationChatData | null
  assignPendingToMessage: (messageId: string) => void
  setAttesting: (messageId: string, isAttesting: boolean) => void
  setReceipt: (messageId: string, receipt: AttestationReceipt) => void
  setError: (messageId: string, error: string) => void
  setVerifying: (messageId: string, isVerifying: boolean) => void
  setVerificationResult: (
    messageId: string,
    verificationResult: VerifyOutput,
    cacheKey?: string
  ) => void
  setVerificationError: (messageId: string, error: string) => void
  clearMessageState: (messageId: string) => void
  getMessageState: (messageId: string) => MessageAttestationState | undefined
  openVerificationDialog: (messageId: string, result: VerifyOutput) => void
  closeVerificationDialog: () => void
  addReference: (reference: ReferenceMetadata) => void
  removeReference: (referenceId: string) => void
  clearReferences: () => void
  getReferences: () => ReferenceMetadata[]
  addReferenceToMessage: (
    messageId: string,
    reference: ReferenceMetadata
  ) => void
  removeReferenceFromMessage: (messageId: string, referenceId: string) => void
  updateReferencesShareId: (messageId: string, shareId: string) => void
  setShareUrl: (
    messageId: string,
    shareUrl: string,
    contentHash: string
  ) => void
  getShareUrl: (messageId: string) => { url: string; hash: string } | undefined
}

// Default attestation API URL (can be overridden in settings)
const DEFAULT_ATTESTATION_API_URL = IS_DEV
  ? 'http://localhost:3000'
  : 'https://near-innovation-sandbox-attest-web.vercel.app'

export const useAttestationStore = create<AttestationState>()(
  persist(
    (set, get) => ({
      settings: {
        attestationApiUrl: DEFAULT_ATTESTATION_API_URL,
      },

      messageStates: {},

      pendingChatData: null,

      verificationDialog: {
        isOpen: false,
        messageId: null,
        verificationResult: null,
        references: [],
      },

      setAttestationApiUrl: (url: string) => {
        set((state) => ({
          settings: {
            ...state.settings,
            attestationApiUrl: url,
          },
        }))
      },

      setChatData: (messageId: string, chatData: AttestationChatData) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              chatData,
              isAttesting: false,
              references: state.messageStates[messageId]?.references || [],
            },
          },
        }))
      },

      getChatData: (messageId: string) => {
        return get().messageStates[messageId]?.chatData
      },

      setPendingChatData: (chatData: AttestationChatData | null) => {
        set({ pendingChatData: chatData })
      },

      getPendingChatData: () => {
        return get().pendingChatData
      },

      assignPendingToMessage: (messageId: string) => {
        const pending = get().pendingChatData
        if (pending) {
          set((state) => ({
            pendingChatData: null,
            messageStates: {
              ...state.messageStates,
              [messageId]: {
                ...state.messageStates[messageId],
                chatData: pending,
                isAttesting: false,
              },
            },
          }))
        }
      },

      setAttesting: (messageId: string, isAttesting: boolean) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              isAttesting,
              isVerifying: false,
              error: isAttesting
                ? undefined
                : state.messageStates[messageId]?.error,
              references: state.messageStates[messageId]?.references || [],
            },
          },
        }))
      },

      setReceipt: (messageId: string, receipt: AttestationReceipt) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              receipt,
              isAttesting: false,
              error: undefined,
            },
          },
        }))
      },

      setError: (messageId: string, error: string) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              isAttesting: false,
              error,
            },
          },
        }))
      },

      setVerifying: (messageId: string, isVerifying: boolean) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              isVerifying,
              verificationError: isVerifying
                ? undefined
                : state.messageStates[messageId]?.verificationError,
            },
          },
        }))
      },

      setVerificationResult: (
        messageId: string,
        verificationResult: VerifyOutput,
        cacheKey?: string
      ) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              verificationResult,
              verificationCacheKey: cacheKey,
              isVerifying: false,
              verificationError: undefined,
            },
          },
        }))
      },

      setVerificationError: (messageId: string, error: string) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              isVerifying: false,
              verificationError: error,
            },
          },
        }))
      },

      clearMessageState: (messageId: string) => {
        set((state) => {
          const { [messageId]: _, ...rest } = state.messageStates
          return { messageStates: rest }
        })
      },

      getMessageState: (messageId: string) => {
        return get().messageStates[messageId]
      },

      openVerificationDialog: (messageId: string, result: VerifyOutput) => {
        const messageState = get().messageStates[messageId]
        set({
          verificationDialog: {
            isOpen: true,
            messageId,
            verificationResult: result,
            references: messageState?.references || [],
          },
        })
      },

      closeVerificationDialog: () => {
        set({
          verificationDialog: {
            isOpen: false,
            messageId: null,
            verificationResult: null,
            references: [],
          },
        })
      },

      addReference: (reference: ReferenceMetadata) => {
        set((state) => {
          const messageId = state.verificationDialog.messageId
          const updatedReferences = [
            ...state.verificationDialog.references,
            reference,
          ]
          return {
            verificationDialog: {
              ...state.verificationDialog,
              references: updatedReferences,
            },
            messageStates: messageId
              ? {
                  ...state.messageStates,
                  [messageId]: {
                    ...state.messageStates[messageId],
                    references: updatedReferences,
                  },
                }
              : state.messageStates,
          }
        })
      },

      removeReference: (referenceId: string) => {
        set((state) => {
          const messageId = state.verificationDialog.messageId
          const updatedReferences = state.verificationDialog.references.filter(
            (ref) => ref.id !== referenceId
          )
          return {
            verificationDialog: {
              ...state.verificationDialog,
              references: updatedReferences,
            },
            messageStates: messageId
              ? {
                  ...state.messageStates,
                  [messageId]: {
                    ...state.messageStates[messageId],
                    references: updatedReferences,
                  },
                }
              : state.messageStates,
          }
        })
      },

      clearReferences: () => {
        set((state) => ({
          verificationDialog: {
            ...state.verificationDialog,
            references: [],
          },
        }))
      },

      getReferences: () => {
        return get().verificationDialog.references
      },

      addReferenceToMessage: (
        messageId: string,
        reference: ReferenceMetadata
      ) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              references: [
                ...(state.messageStates[messageId]?.references || []),
                reference,
              ],
            },
          },
        }))
      },

      removeReferenceFromMessage: (messageId: string, referenceId: string) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              references: (
                state.messageStates[messageId]?.references || []
              ).filter((ref) => ref.id !== referenceId),
            },
          },
        }))
      },

      updateReferencesShareId: (messageId: string, shareId: string) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              references: (
                state.messageStates[messageId]?.references || []
              ).map((ref) => (ref.shareId ? ref : { ...ref, shareId })),
            },
          },
        }))
      },

      setShareUrl: (
        messageId: string,
        shareUrl: string,
        contentHash: string
      ) => {
        set((state) => ({
          messageStates: {
            ...state.messageStates,
            [messageId]: {
              ...state.messageStates[messageId],
              shareUrl,
              shareContentHash: contentHash,
              references: state.messageStates[messageId]?.references || [],
            },
          },
        }))
      },

      getShareUrl: (messageId: string) => {
        const messageState = get().messageStates[messageId]
        if (messageState?.shareUrl && messageState?.shareContentHash) {
          return {
            url: messageState.shareUrl,
            hash: messageState.shareContentHash,
          }
        }
        return undefined
      },
    }),
    {
      name: 'attestation-store',
      // Persist settings and message states (including receipts)
      partialize: (state) => ({
        settings: state.settings,
        messageStates: state.messageStates,
      }),
    }
  )
)
