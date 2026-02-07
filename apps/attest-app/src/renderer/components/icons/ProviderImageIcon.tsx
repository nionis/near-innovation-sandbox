import { Image } from '@mantine/core'
import type { ModelProvider } from 'src/shared/types'
import { useProviders } from '@/hooks/useProviders'
import CustomProviderIcon from '../CustomProviderIcon'

const iconContext = (require as any).context('../../static/icons/providers', false, /\.png$/)
const icons: { name: string; src: string }[] = iconContext.keys().map((key: string) => ({
  name: key.replace('./', '').replace('.png', ''), // 获取图片名称
  src: iconContext(key), // 获取图片路径
}))

export default function ProviderImageIcon(props: {
  className?: string
  size?: number
  provider: ModelProvider | string
  providerName?: string
}) {
  const { className, size = 24, provider, providerName } = props

  const {providers} = useProviders()
  const providerInfo = providers.find((p) => p.id === provider)
  
  if(providerInfo?.isCustom){
    return providerInfo.iconUrl ? (
      <Image w={size} h={size} src={providerInfo.iconUrl} alt={providerInfo.name} />
    ) : (
      <CustomProviderIcon providerId={providerInfo.id} providerName={providerInfo.name} size={size} />
    )
  }

  const iconSrc = icons.find((icon) => icon.name === provider)?.src

  return iconSrc ? (
    <Image w={size} h={size} src={iconSrc} className={className} alt={`${providerName || provider} image icon`} />
  ) : providerName ? (
    <CustomProviderIcon providerId={provider} providerName={providerName} size={size} />
  ) : null
}
