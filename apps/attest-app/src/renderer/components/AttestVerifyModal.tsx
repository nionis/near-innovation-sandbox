import NiceModal, { useModal } from '@ebay/nice-modal-react'
import {
  attest,
  storeAttestationRecordWithAPI,
  verify,
  type AttestOutput,
  type VerifyOutput,
} from '@repo/packages-attestations'
import { computeProofHash } from '@repo/packages-attestations/crypto'
import { AttestationsBlockchain } from '@repo/packages-attestations/blockchain'
import { NEAR_AI_BASE_URL, NRAS_BASE_URL } from '@repo/packages-utils/near'
import { Button, Divider, Flex, Loader, Modal, Stack, Text } from '@mantine/core'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModelProviderEnum, type Session } from '../../shared/types'
import { settingsStore } from '@/stores/settingsStore'

const RECEIPT_VERSION = '1.0.0'
const TESTNET_CONTRACT_ID = 'nis-attestations-02.testnet'
const STORE_API_URL = (typeof process !== 'undefined' && process.env?.ATTEST_STORE_API_URL) || ''

function getModelFromRequestBody(requestBody: string): string {
  try {
    return JSON.parse(requestBody)?.model ?? ''
  } catch {
    return ''
  }
}

const AttestVerifyModal = NiceModal.create(({ session }: { session: Session }) => {
  const modal = useModal()
  const { t } = useTranslation()
  const captured = session?.capturedResponse
  const apiKey = settingsStore.getState().getSettings().providers?.[ModelProviderEnum.NearAI]?.apiKey ?? ''
  const apiHost =
    settingsStore.getState().getSettings().providers?.[ModelProviderEnum.NearAI]?.apiHost ?? NEAR_AI_BASE_URL

  const [step, setStep] = useState<'idle' | 'attesting' | 'attested' | 'storing' | 'verified' | 'error'>('idle')
  const [attestOutput, setAttestOutput] = useState<AttestOutput | null>(null)
  const [attestTimestamp, setAttestTimestamp] = useState<number>(0)
  const [txHash, setTxHash] = useState<string>('')
  const [verifyResult, setVerifyResult] = useState<VerifyOutput | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const requestBodyForAttest = captured?.e2ee ? captured.encryptedRequestBody ?? captured.requestBody : captured?.requestBody ?? ''
  const responseBodyForAttest = captured?.responseBody ?? ''
  const chatId = captured?.chatId

  const receipt = attestOutput
    ? {
        version: RECEIPT_VERSION,
        timestamp: attestTimestamp,
        txHash: txHash || '',
        model: getModelFromRequestBody(captured?.requestBody ?? ''),
        requestBody: requestBodyForAttest,
        responseBody: responseBodyForAttest,
        signature: attestOutput.signature,
        signingAddress: attestOutput.signingAddress,
        signingAlgo: attestOutput.signingAlgo,
        ...(captured?.e2ee && captured.passphrase && captured.modelsPublicKey
          ? {
              e2ee: true as const,
              passphrase: Array.isArray(captured.passphrase) ? captured.passphrase.join(' ') : captured.passphrase,
              modelsPublicKey: captured.modelsPublicKey,
            }
          : { e2ee: false as const, passphrase: undefined, modelsPublicKey: undefined }),
      }
    : null

  const handleAttest = useCallback(async () => {
    if (!session?.id || !captured || !chatId || !apiKey) {
      setErrorMessage(t('Missing captured data, chat ID, or API key. Send a message and try again.'))
      setStep('error')
      return
    }
    setStep('attesting')
    setErrorMessage('')
    try {
      const output = await attest(
        {
          chatId,
          requestBody: requestBodyForAttest,
          responseBody: responseBodyForAttest,
        },
        apiKey,
        { nearAiBaseURL: apiHost.replace(/\/v1\/?$/, '') }
      )
      setAttestOutput(output)
      setAttestTimestamp(Date.now())
      setStep('attested')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStep('error')
    }
  }, [session?.id, captured, chatId, apiKey, apiHost, requestBodyForAttest, responseBodyForAttest, t])

  const handleStoreOnBlockchain = useCallback(async () => {
    if (!attestOutput || !receipt) return
    if (!STORE_API_URL) {
      setErrorMessage(t('Store API URL not configured (ATTEST_STORE_API_URL).'))
      setStep('error')
      return
    }
    setStep('storing')
    setErrorMessage('')
    try {
      const proofHash = computeProofHash(
        attestOutput.requestHash,
        attestOutput.responseHash,
        attestOutput.signature
      )
      const { txHash: hash } = await storeAttestationRecordWithAPI(STORE_API_URL, {
        proofHash,
        timestamp: receipt.timestamp,
      })
      setTxHash(hash)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStep('error')
    }
  }, [attestOutput, receipt, t])

  const handleVerify = useCallback(async () => {
    if (!receipt) return
    setStep('verified')
    setErrorMessage('')
    try {
      const blockchain = new AttestationsBlockchain({
        networkId: 'testnet',
        contractId: TESTNET_CONTRACT_ID,
      })
      const result = await verify(
        {
          model: receipt.model as import('@repo/packages-utils/near').NearAIChatModelId,
          requestBody: receipt.requestBody,
          responseBody: receipt.responseBody,
          signature: receipt.signature,
          signingAddress: receipt.signingAddress,
          signingAlgo: receipt.signingAlgo,
          timestamp: receipt.timestamp,
        },
        blockchain,
        {
          nearAiBaseURL: apiHost.replace(/\/v1\/?$/, ''),
          nrasUrl: NRAS_BASE_URL,
        }
      )
      setVerifyResult(result)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStep('error')
    }
  }, [receipt, apiHost])

  const handleExportReceipt = useCallback(() => {
    if (!receipt) return
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attestation-receipt-${session?.id ?? 'session'}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [receipt, session?.id])

  const canAttest = !!captured && !!chatId && !!apiKey
  const isBusy = step === 'attesting' || step === 'storing'

  return (
    <Modal
      title={t('Attest & Verify')}
      opened={modal.visible}
      onClose={() => modal.hide()}
      size="md"
    >
      <Stack gap="md">
        {!captured ? (
          <Text size="sm" c="dimmed">
            {t('Send a message and wait for a response to attest this conversation.')}
          </Text>
        ) : !chatId ? (
          <Text size="sm" c="dimmed">
            {t('Chat ID not found in response. Try sending another message.')}
          </Text>
        ) : !apiKey ? (
          <Text size="sm" c="dimmed">
            {t('Configure NEAR AI API key in Settings to attest.')}
          </Text>
        ) : null}

        {errorMessage && (
          <Text size="sm" c="red">
            {errorMessage}
          </Text>
        )}

        <Flex gap="xs" wrap="wrap">
          <Button
            variant="light"
            disabled={!canAttest || isBusy}
            leftSection={step === 'attesting' ? <Loader size="xs" /> : null}
            onClick={handleAttest}
          >
            {t('Attest')}
          </Button>
          {attestOutput && (
            <>
              <Button
                variant="light"
                disabled={!STORE_API_URL || isBusy}
                leftSection={step === 'storing' ? <Loader size="xs" /> : null}
                onClick={handleStoreOnBlockchain}
              >
                {t('Store on Blockchain')}
              </Button>
              <Button variant="light" onClick={handleVerify}>
                {t('Verify')}
              </Button>
            </>
          )}
          {receipt && (
            <Button variant="outline" onClick={handleExportReceipt}>
              {t('Export receipt JSON')}
            </Button>
          )}
        </Flex>

        {txHash && (
          <Text size="xs" c="dimmed">
            {t('Tx hash')}: {txHash}
          </Text>
        )}

        {verifyResult && (
          <>
            <Divider />
            <Text fw={600} size="sm">
              {verifyResult.result.valid ? t('Receipt verified') : t('Verification failed')}
            </Text>
            <Stack gap="xs">
              <VerificationRow label={t('Chat attestation')} result={verifyResult.chat} />
              <VerificationRow label={t('Blockchain notarization')} result={verifyResult.notorized} />
              <VerificationRow label={t('Model GPU')} result={verifyResult.model_gpu} />
              <VerificationRow label={t('Model TDX')} result={verifyResult.model_tdx} />
              <VerificationRow label={t('Model compose')} result={verifyResult.model_compose} />
              <VerificationRow label={t('Gateway TDX')} result={verifyResult.gateway_tdx} />
              <VerificationRow label={t('Gateway compose')} result={verifyResult.gateway_compose} />
            </Stack>
          </>
        )}
      </Stack>
    </Modal>
  )
})

function VerificationRow({
  label,
  result,
}: {
  label: string
  result: { valid: boolean; message?: string }
}) {
  const { t } = useTranslation()
  return (
    <Flex justify="space-between" align="center" gap="xs">
      <Text size="xs">{label}</Text>
      <Text size="xs" c={result.valid ? 'green' : 'red'}>
        {result.valid ? t('Valid') : result.message ?? t('Invalid')}
      </Text>
    </Flex>
  )
}

export default AttestVerifyModal
