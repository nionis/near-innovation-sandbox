import { Flex, Menu, Text } from '@mantine/core'
import { IconFileZip } from '@tabler/icons-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from 'src/shared/utils'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { ScalableIcon } from '../ScalableIcon'

type Props = {
  currentInputTokens: number
  contextTokens: number
  totalTokens: number
  contextWindow?: number
  currentMessageCount?: number
  maxContextMessageCount?: number
  children?: React.ReactNode
  onCompressClick?: () => void
}

const TokenCountMenu: FC<Props> = ({
  currentInputTokens,
  contextTokens,
  totalTokens,
  contextWindow,
  currentMessageCount,
  maxContextMessageCount,
  children,
  onCompressClick,
}) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()

  return (
    <Menu
      trigger={isSmallScreen ? 'click' : 'hover'}
      openDelay={100}
      closeDelay={100}
      position="top"
      shadow="md"
      keepMounted
      transitionProps={{
        transition: 'pop',
        duration: 200,
      }}
    >
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown className="min-w-56">
        <Menu.Label fw={600}>{t('Estimated Token Usage')}</Menu.Label>

        <Menu.Item disabled style={{ cursor: 'default' }}>
          <Flex justify="space-between" align="center" gap="xs">
            <Text size="sm">{t('Current input')}:</Text>
            <Text size="sm" fw={500}>
              {formatNumber(currentInputTokens)}
            </Text>
          </Flex>
        </Menu.Item>

        <Menu.Item disabled style={{ cursor: 'default' }}>
          <Flex justify="space-between" align="center" gap="xs">
            <Text size="sm">{t('Context')}:</Text>
            <Text size="sm" fw={500}>
              {formatNumber(contextTokens)}
            </Text>
          </Flex>
        </Menu.Item>

        {maxContextMessageCount !== undefined && currentMessageCount !== undefined && (
          <Menu.Item disabled style={{ cursor: 'default' }}>
            <Flex justify="space-between" align="center" gap="xs">
              <Text size="sm">{t('Context messages')}:</Text>
              <Text size="sm" fw={500}>
                {maxContextMessageCount === Number.MAX_SAFE_INTEGER
                  ? currentMessageCount
                  : `${currentMessageCount} / ${maxContextMessageCount}`}
              </Text>
            </Flex>
          </Menu.Item>
        )}

        <Menu.Divider />

        <Menu.Item disabled style={{ cursor: 'default' }}>
          <Flex justify="space-between" align="center" gap="xs">
            <Text size="sm" fw={600}>
              {t('Total')}:
            </Text>
            <Text size="sm" fw={600}>
              {formatNumber(totalTokens)}
            </Text>
          </Flex>
        </Menu.Item>

        {contextWindow && (
          <Menu.Item disabled style={{ cursor: 'default' }}>
            <Flex justify="space-between" align="center" gap="xs">
              <Text size="sm">{t('Model limit')}:</Text>
              <Text size="sm" fw={500}>
                {formatNumber(contextWindow)}
              </Text>
            </Flex>
          </Menu.Item>
        )}

        {onCompressClick && contextTokens > 0 && (
          <>
            <Menu.Divider />
            <Menu.Item
              leftSection={<ScalableIcon icon={IconFileZip} size={16} />}
              onClick={onCompressClick}
              color="chatbox-brand"
            >
              {t('Compress Conversation')}
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

export default TokenCountMenu
