import { getModel } from 'src/shared/models'
import CustomOpenAI from 'src/shared/models/custom-openai'
import {
  type ModelProvider,
  ModelProviderEnum,
  type ProviderBaseInfo,
  type ProviderSettings,
  type SessionType,
} from 'src/shared/types'
import { createModelDependencies } from '@/adapters'
import BaseConfig from './base-config'
import type { ModelSettingUtil } from './interface'

// TODO: 重新实现
export default class CustomModelSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.Custom
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings,
    providerBaseInfo?: ProviderBaseInfo
  ): Promise<string> {
    const providerName = providerBaseInfo?.name ?? 'Custom API'
    return `${providerName} (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const model = settings.models?.[0] || { modelId: 'gpt-4o-mini' }

    const dependencies = await createModelDependencies()
    const customOpenAI = new CustomOpenAI(
      {
        apiHost: settings.apiHost!,
        apiKey: settings.apiKey!,
        apiPath: settings.apiPath!,
        model,
        temperature: 0,
        useProxy: settings.useProxy,
      },
      dependencies
    )
    return customOpenAI.listModels()
  }
}
