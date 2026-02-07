import { Menu, type MenuItemProps, type MenuProps, parseThemeColor, useMantineTheme } from '@mantine/core'
import { IconCheck, type IconProps } from '@tabler/icons-react'
import { type FC, type MouseEventHandler, type ReactElement, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from './ScalableIcon'

export type ActionMenuItemProps =
  | {
      divider?: false
      text: string
      icon?: React.ElementType<IconProps>
      color?: MenuItemProps['color']
      onClick?: MouseEventHandler<HTMLButtonElement>
      doubleCheck?:
        | boolean
        | {
            text?: string // 二次确认的文字，默认 t('Confirm?')
            icon?: React.ElementType<IconProps>
            color?: MenuItemProps['color']
            timeout?: number // 二次确认的超时时间，默认 5000 毫秒
          } // 点击时需要二次确认
    }
  | {
      divider: true
    }

export type ActionMenuProps = {
  children: ReactElement
  items: ActionMenuItemProps[]
} & MenuProps

export const ActionMenu: FC<ActionMenuProps> = ({ children, items, position = 'bottom-start', ...menuProps }) => {
  const theme = useMantineTheme()

  return (
    <Menu position={position} {...menuProps}>
      <Menu.Target>{children}</Menu.Target>

      <Menu.Dropdown miw={150} onClick={(e) => e.stopPropagation()}>
        {items.map((item, index) =>
          item.divider ? (
            <Menu.Divider key={`divider-${item.divider}-${index}`} />
          ) : item.doubleCheck ? (
            <DoubleCheckMenuItem
              key={`${item.text}${index}`}
              color={item.color ?? 'chatbox-error'}
              text={item.text}
              icon={item.icon}
              doubleCheckText={item.doubleCheck === true ? undefined : item.doubleCheck.text}
              doubleCheckIcon={item.doubleCheck === true ? undefined : item.doubleCheck.icon}
              doubleCheckColor={item.doubleCheck === true ? undefined : item.doubleCheck.color}
              onClick={item.onClick}
            />
          ) : (
            <Menu.Item
              key={`${item.text}${index}`}
              leftSection={item.icon ? <ScalableIcon icon={item.icon} size={14} /> : undefined}
              color={item.color || 'chatbox-primary'}
              style={{
                color: theme.variantColorResolver({ color: item.color || 'chatbox-primary', theme, variant: 'light' })
                  .color,
              }}
              onClick={item.onClick}
            >
              {item.text}
            </Menu.Item>
          )
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

export default ActionMenu

const DoubleCheckMenuItem = ({
  timeout = 5000,
  text,
  onClick,
  icon,
  doubleCheckText,
  doubleCheckIcon,
  doubleCheckColor,
  ...menuItemProps
}: {
  timeout?: number
  text: string
  icon?: React.ElementType<IconProps>
  onClick?: MouseEventHandler<HTMLButtonElement>
  doubleCheckText?: string
  doubleCheckIcon?: React.ElementType<IconProps>
  doubleCheckColor?: MenuItemProps['color']
} & MenuItemProps) => {
  const { t } = useTranslation()
  const [showConfirm, setShowConfirm] = useState(false)
  useEffect(() => {
    if (showConfirm) {
      const tid = setTimeout(() => {
        setShowConfirm(false)
      }, timeout)

      return () => clearTimeout(tid)
    }
  }, [showConfirm, timeout])

  const theme = useMantineTheme()

  return !showConfirm ? (
    <Menu.Item
      closeMenuOnClick={false}
      leftSection={icon ? <ScalableIcon icon={icon} size={14} /> : undefined}
      onClick={() => setShowConfirm(true)}
      {...menuItemProps}
      style={{
        color: menuItemProps.color
          ? theme.variantColorResolver({ color: menuItemProps.color, theme, variant: 'light' }).color
          : undefined,
      }}
    >
      {text}
    </Menu.Item>
  ) : (
    <Menu.Item
      leftSection={<ScalableIcon icon={doubleCheckIcon || IconCheck} size={14} />}
      onClick={onClick}
      {...menuItemProps}
      color={doubleCheckColor ?? menuItemProps.color}
      style={{
        color:
          (doubleCheckColor ?? menuItemProps.color)
            ? theme.variantColorResolver({ color: doubleCheckColor ?? menuItemProps.color, theme, variant: 'light' })
                .color
            : undefined,
      }}
    >
      {doubleCheckText ?? t('Confirm?')}
    </Menu.Item>
  )
}
