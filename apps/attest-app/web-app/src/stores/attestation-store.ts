import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Chat data required for attestation
 * Matches the Chat interface from @repo/packages-attestations
 */
export interface AttestationChatData {
  id: string
  requestBody: string
  responseBody: string
  output: string
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
 * Attestation state for a single message
 */
export interface MessageAttestationState {
  chatData?: AttestationChatData
  receipt?: AttestationReceipt
  isAttesting: boolean
  error?: string
}

interface AttestationSettings {
  attestationApiUrl: string
}

interface AttestationState {
  // Settings
  settings: AttestationSettings

  // Per-message attestation state (keyed by message ID)
  messageStates: Record<string, MessageAttestationState>

  // Pending chat data waiting to be assigned to a message ID
  pendingChatData: AttestationChatData | null

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
  clearMessageState: (messageId: string) => void
  getMessageState: (messageId: string) => MessageAttestationState | undefined
}

// Default attestation API URL (can be overridden in settings)
const DEFAULT_ATTESTATION_API_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://near-innovation-sandbox-attest-web.vercel.app'
    : 'http://localhost:3000'

export const useAttestationStore = create<AttestationState>()(
  persist(
    (set, get) => ({
      settings: {
        attestationApiUrl: DEFAULT_ATTESTATION_API_URL,
      },

      messageStates: {},

      pendingChatData: null,

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
              error: isAttesting
                ? undefined
                : state.messageStates[messageId]?.error,
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

      clearMessageState: (messageId: string) => {
        set((state) => {
          const { [messageId]: _, ...rest } = state.messageStates
          return { messageStates: rest }
        })
      },

      getMessageState: (messageId: string) => {
        return get().messageStates[messageId]
      },
    }),
    {
      name: 'attestation-store',
      // Only persist settings, not message states (they're session-specific)
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
)
