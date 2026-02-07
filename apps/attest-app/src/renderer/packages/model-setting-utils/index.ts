import { SystemProviders } from 'src/shared/defaults'
import {
  type ModelProvider,
  ModelProviderEnum,
  ModelProviderType,
  type SessionSettings,
  type SessionType,
  type Settings,
} from 'src/shared/types'
import type { ModelSettingUtil } from './interface'
import NearAISettingUtil from './near-ai-setting-util'

export function getModelSettingUtil(
  aiProvider: ModelProvider,
  _customProviderType?: ModelProviderType
): ModelSettingUtil {
  const hash: Partial<Record<ModelProvider, new () => ModelSettingUtil>> = {
    [ModelProviderEnum.NearAI]: NearAISettingUtil,
  }
  if (hash[aiProvider]) {
    return new (hash[aiProvider]!)()
  }
  return new NearAISettingUtil()
}

export function getModelDisplayName(settings: SessionSettings, globalSettings: Settings, sessionType: SessionType) {
  const provider = settings.provider ?? ModelProviderEnum.NearAI
  const model = settings.modelId ?? ''

  const providerBaseInfo =
    globalSettings.customProviders?.find((p) => p.id === provider) || SystemProviders.find((p) => p.id === provider)

  const util = getModelSettingUtil(provider, providerBaseInfo?.isCustom ? providerBaseInfo.type : undefined)
  const providerSettings = globalSettings.providers?.[provider]
  return util.getCurrentModelDisplayName(model, sessionType, providerSettings, providerBaseInfo)
}
