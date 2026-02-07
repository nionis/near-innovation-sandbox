import { useMantineTheme } from '@mantine/core'
import type { IconProps } from '@tabler/icons-react'
import { forwardRef } from 'react'

type Props = Omit<IconProps, 'size'> & {
  size?: number
  icon: React.ElementType<IconProps>
}

export const ScalableIcon = forwardRef<SVGSVGElement, Props>((props, ref) => {
  const { icon: IconComponent, size = 16, ...others } = props
  const theme = useMantineTheme()
  const scale = theme.scale ?? 1
  return <IconComponent ref={ref} size={size * scale} {...others} />
})
