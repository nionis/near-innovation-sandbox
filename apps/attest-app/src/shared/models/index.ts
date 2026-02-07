import { SystemProviders } from '../defaults'
import {
  type Config,
  type ModelProvider,
  ModelProviderEnum,
  type SessionSettings,
  type Settings,
} from '../types'
import type { ModelDependencies } from '../types/adapters'
import NearAI from './near-ai'
import type { ModelInterface } from './types'

export function getProviderSettings(setting: SessionSettings, globalSettings: Settings) {
  console.debug('getModel', setting.provider, setting.modelId)
  const provider = setting.provider
  if (!provider) {
    throw new Error('Model provider must not be empty.')
  }
  const providerBaseInfo = [...SystemProviders, ...(globalSettings.customProviders || [])].find(
    (p) => p.id === provider
  )
  if (!providerBaseInfo) {
    throw new Error(`Cannot find model with provider: ${setting.provider}`)
  }
  const providerSetting = globalSettings.providers?.[provider] || {}
  const formattedApiHost = (providerSetting.apiHost || providerBaseInfo.defaultSettings?.apiHost || '').trim()
  return {
    providerSetting,
    formattedApiHost,
    providerBaseInfo,
  }
}

export function getModel(
  settings: SessionSettings,
  globalSettings: Settings,
  config: Config,
  dependencies: ModelDependencies
): ModelInterface {
  console.debug('getModel', settings.provider, settings.modelId)
  const provider = settings.provider
  if (!provider) {
    throw new Error('Model provider must not be empty.')
  }
  const { providerSetting, formattedApiHost, providerBaseInfo } = getProviderSettings(settings, globalSettings)

  let model = providerSetting.models?.find((m) => m.modelId === settings.modelId)
  if (!model) {
    model = SystemProviders.find((p) => p.id === provider)?.defaultSettings?.models?.find(
      (m) => m.modelId === settings.modelId
    )
  }
  if (!model) {
    model = {
      modelId: settings.modelId ?? '',
    }
  }

  switch (provider) {
    case ModelProviderEnum.NearAI:
      return new NearAI(
        {
          apiKey: providerSetting.apiKey || '',
          apiHost: formattedApiHost,
          model,
          temperature: settings.temperature,
          topP: settings.topP,
          maxOutputTokens: settings.maxTokens,
          stream: settings.stream,
          e2eeEnabled: providerSetting.e2eeEnabled ?? false,
        },
        dependencies
      )
    default:
      throw new Error(`Cannot find model with provider: ${settings.provider}`)
  }
}

export const aiProviderNameHash: Record<ModelProvider, string> = {
  [ModelProviderEnum.NearAI]: 'NEAR AI',
}

export const AIModelProviderMenuOptionList = [
  {
    value: ModelProviderEnum.NearAI,
    label: aiProviderNameHash[ModelProviderEnum.NearAI],
    featured: true,
    disabled: false,
  },
]
