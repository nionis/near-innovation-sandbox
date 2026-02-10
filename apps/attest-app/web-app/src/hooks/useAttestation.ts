import { useCallback } from 'react'
import {
  useAttestationStore,
  type AttestationReceipt,
} from '@/stores/attestation-store'
import { useModelProvider } from '@/hooks/useModelProvider'
import {
  attest,
  verify,
  storeAttestationRecordWithAPI,
  type VerifyInput,
  type VerifyOutput,
} from '@repo/packages-attestations'
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain'
import { computeProofHash } from '@repo/packages-attestations/crypto'
import { toast } from 'sonner'
// import { fetch as fetchTauri } from '@tauri-apps/plugin-http'
import type { NearAIChatModelId } from '@repo/packages-utils/near'
import type { NearBlockchainNetwork } from '@repo/packages-utils/near'
import * as SMART_CONTRACTS from '@repo/contracts-attestations/deployment'

const DEFAULT_ATTESTATION_API_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://near-innovation-sandbox-attest-web.vercel.app'
    : 'http://localhost:3000'

const NETWORK_ID: NearBlockchainNetwork = 'testnet'
const CONTRACT_ID = SMART_CONTRACTS[NETWORK_ID].contractId
const blockchain = new AttestationsBlockchain({
  contractId: CONTRACT_ID,
  networkId: NETWORK_ID,
})

/** fetch that is used to proxy to '/api/verify?url=' */
const proxyFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.toString()
  return fetch(
    `${DEFAULT_ATTESTATION_API_URL}/api/verify?url=${encodeURIComponent(url)}`,
    init
  )
}

/**
 * Hook for generating verifiable proofs for AI-generated content
 * Uses the NEAR AI attestation system to create cryptographically signed receipts
 */
export function useAttestation() {
  const {
    getChatData,
    setAttesting,
    setReceipt,
    setError,
    setVerifying,
    setVerificationResult,
    setVerificationError,
    getMessageState,
    settings,
    openVerificationDialog,
  } = useAttestationStore()
  const getProviderByName = useModelProvider((state) => state.getProviderByName)

  /**
   * Verify a proof for a message
   * @param messageId - The ID of the message to verify
   * @returns The verification output or null if failed
   */
  const verifyProof = useCallback(
    async (messageId: string): Promise<VerifyOutput | null> => {
      // Get the message state
      const messageState = getMessageState(messageId)
      if (!messageState?.chatData || !messageState?.receipt) {
        const error =
          'No attestation data or receipt available for this message'
        setVerificationError(messageId, error)
        toast.error(error)
        return null
      }

      const { chatData, receipt } = messageState

      try {
        // Mark as verifying
        setVerifying(messageId, true)
        toast.info('Verifying proof...')

        // Extract model from requestBody
        let model: NearAIChatModelId
        try {
          const parsed = JSON.parse(chatData.requestBody)
          model = parsed.model as NearAIChatModelId
        } catch (error) {
          const errorMessage = 'Failed to parse request body to extract model'
          setVerificationError(messageId, errorMessage)
          toast.error('Verification failed', {
            description: errorMessage,
          })
          return null
        }

        // Prepare the verify input
        const verifyInput: VerifyInput = {
          model,
          requestBody: chatData.requestBody,
          responseBody: chatData.responseBody,
          signature: receipt.signature,
          signingAddress: receipt.signingAddress,
          signingAlgo: receipt.signingAlgo,
          timestamp: receipt.timestamp,
        }

        // Verify the proof
        const verificationResult = await verify(verifyInput, blockchain, {
          fetch: proxyFetch,
        })

        // Store the verification result
        setVerificationResult(messageId, verificationResult)

        // Open the verification dialog instead of showing a toast
        openVerificationDialog(messageId, verificationResult)

        return verificationResult
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to verify proof'
        setVerificationError(messageId, errorMessage)
        toast.error('Verification failed', {
          description: errorMessage,
        })
        return null
      }
    },
    [
      getMessageState,
      setVerifying,
      setVerificationResult,
      setVerificationError,
      settings.attestationApiUrl,
    ]
  )

  /**
   * Generate a verifiable proof for a message
   * @param messageId - The ID of the message to attest
   * @param shouldVerify - Whether to verify the proof after generation
   * @returns The attestation receipt or null if failed
   */
  const generateProof = useCallback(
    async (
      messageId: string,
      shouldVerify: boolean = false
    ): Promise<AttestationReceipt | null> => {
      // Get the chat data for this message
      const chatData = getChatData(messageId)
      if (!chatData) {
        const error = 'No attestation data available for this message'
        setError(messageId, error)
        toast.error(error)
        return null
      }

      // Get the NEAR AI API key from provider settings
      const nearAiProvider = getProviderByName('near-ai')
      const apiKey = nearAiProvider?.api_key
      if (!apiKey) {
        const error =
          'NEAR AI API key not configured. Please set your API key in provider settings.'
        setError(messageId, error)
        toast.error(error)
        return null
      }

      try {
        // Mark as attesting
        setAttesting(messageId, true)
        toast.info('Generating verifiable proof...')

        // Step 1: Create the attestation receipt
        const attestOutput = await attest(
          {
            chatId: chatData.id,
            requestBody: chatData.requestBody,
            responseBody: chatData.responseBody,
          },
          apiKey,
          {
            fetch: proxyFetch,
          }
        )

        const proofHash = computeProofHash(
          attestOutput.requestHash,
          attestOutput.responseHash,
          attestOutput.signature
        )
        const timestamp = Date.now()

        // Step 2: Store on blockchain via API
        const { txHash } = await storeAttestationRecordWithAPI(
          settings.attestationApiUrl,
          {
            proofHash,
            timestamp,
          }
        )

        // Construct the full receipt
        const fullReceipt: AttestationReceipt = {
          requestHash: attestOutput.requestHash,
          responseHash: attestOutput.responseHash,
          signature: attestOutput.signature,
          signingAddress: attestOutput.signingAddress,
          signingAlgo: attestOutput.signingAlgo,
          proofHash,
          timestamp,
          txHash,
        }

        // Store the receipt
        setReceipt(messageId, fullReceipt)

        toast.success('Proof generated successfully!', {
          description: `Transaction: ${txHash.slice(0, 8)}...${txHash.slice(-8)}`,
          action: {
            label: 'Verify',
            onClick: async () => {
              // Verify the proof when Verify is clicked
              await verifyProof(messageId)
            },
          },
        })

        // If shouldVerify is true, automatically verify after generation
        if (shouldVerify) {
          await verifyProof(messageId)
        }

        return fullReceipt
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to generate proof'
        setError(messageId, errorMessage)
        toast.error('Failed to generate proof', {
          description: errorMessage,
        })
        return null
      }
    },
    [
      getChatData,
      getProviderByName,
      setAttesting,
      setReceipt,
      setError,
      settings.attestationApiUrl,
      verifyProof,
    ]
  )

  return {
    generateProof,
    verifyProof,
  }
}
