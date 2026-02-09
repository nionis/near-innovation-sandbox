import { useCallback } from 'react'
import { useAttestationStore, type AttestationReceipt } from '@/stores/attestation-store'
import { useModelProvider } from '@/hooks/useModelProvider'
import { attest, storeAttestationRecordWithAPI } from '@repo/packages-attestations'
import { toast } from 'sonner'

/**
 * Hook for generating verifiable proofs for AI-generated content
 * Uses the NEAR AI attestation system to create cryptographically signed receipts
 */
export function useAttestation() {
  const { getChatData, setAttesting, setReceipt, setError, settings } =
    useAttestationStore()
  const getProviderByName = useModelProvider((state) => state.getProviderByName)

  /**
   * Generate a verifiable proof for a message
   * @param messageId - The ID of the message to attest
   * @returns The attestation receipt or null if failed
   */
  const generateProof = useCallback(
    async (messageId: string): Promise<AttestationReceipt | null> => {
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
        const error = 'NEAR AI API key not configured. Please set your API key in provider settings.'
        setError(messageId, error)
        toast.error(error)
        return null
      }

      try {
        // Mark as attesting
        setAttesting(messageId, true)
        toast.info('Generating verifiable proof...')

        // Step 1: Create the attestation receipt
        const receipt = await attest(chatData, apiKey)

        // Step 2: Store on blockchain via API
        const { txHash } = await storeAttestationRecordWithAPI(
          settings.attestationApiUrl,
          {
            proofHash: receipt.proofHash,
            timestamp: receipt.timestamp,
          }
        )

        // Update the receipt with the transaction hash
        const fullReceipt: AttestationReceipt = {
          ...receipt,
          txHash,
        }

        // Store the receipt
        setReceipt(messageId, fullReceipt)

        toast.success('Proof generated successfully!', {
          description: `Transaction: ${txHash.slice(0, 8)}...${txHash.slice(-8)}`,
          action: {
            label: 'View',
            onClick: () => {
              // Open NEAR explorer for the transaction
              window.open(
                `https://testnet.nearblocks.io/txns/${txHash}`,
                '_blank'
              )
            },
          },
        })

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
    [getChatData, getProviderByName, setAttesting, setReceipt, setError, settings.attestationApiUrl]
  )

  return {
    generateProof,
  }
}
