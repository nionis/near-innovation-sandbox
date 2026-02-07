import OpenAI from 'src/shared/models/openai'
import { type ModelProvider, ModelProviderEnum, type ProviderSettings, type SessionType } from 'src/shared/types'
import { createModelDependencies } from '@/adapters'
import BaseConfig from './base-config'
import type { ModelSettingUtil } from './interface'

export default class OpenAISettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.OpenAI
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    if (sessionType === 'picture') {
      return `OpenAI API (DALL-E-3)`
    } else {
      return `OpenAI API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
    }
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const model = settings.models?.[0] || { modelId: 'gpt-4o-mini' }
    const dependencies = await createModelDependencies()
    const openai = new OpenAI(
      {
        apiHost: settings.apiHost!,
        apiKey: settings.apiKey!,
        model,
        temperature: 0,
        dalleStyle: 'vivid',
        injectDefaultMetadata: false,
        useProxy: settings.useProxy || false,
      },
      dependencies
    )
    return openai.listModels()
  }
}
