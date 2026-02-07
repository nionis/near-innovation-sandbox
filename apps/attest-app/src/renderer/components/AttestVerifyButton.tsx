import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { IconShieldCheck } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { Session } from '../../shared/types'
import { ScalableIcon } from './ScalableIcon'

export function AttestVerifyButton({ session }: { session: Session }) {
  const { t } = useTranslation()
  return (
    <Tooltip label={t('Attest & Verify')}>
      <ActionIcon
        variant="subtle"
        size={28}
        color="chatbox-secondary"
        onClick={() => NiceModal.show('attest-verify', { session })}
      >
        <ScalableIcon icon={IconShieldCheck} size={20} strokeWidth={1.8} />
      </ActionIcon>
    </Tooltip>
  )
}
