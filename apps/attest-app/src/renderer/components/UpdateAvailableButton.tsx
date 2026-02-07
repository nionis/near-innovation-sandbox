import { Button } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import platform from '@/platform'
import { ScalableIcon } from './ScalableIcon'

const UpdateAvailableButton = () => {
  const { t } = useTranslation()

  const handleUpdateInstall = () => {
    platform.installUpdate()
  }

  return (
    <Button
      h={28}
      px="xs"
      bd={0}
      radius={14}
      variant="light"
      color="chatbox-warning"
      leftSection={<ScalableIcon icon={IconRefresh} />}
      onClick={handleUpdateInstall}
    >
      {t('Update Available')}
    </Button>
  )
}

export default UpdateAvailableButton
