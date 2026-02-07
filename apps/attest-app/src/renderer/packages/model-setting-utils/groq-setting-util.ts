import Groq from 'src/shared/models/groq'
import {
  type ModelProvider,
  ModelProviderEnum,
  type ProviderModelInfo,
  type ProviderSettings,
  type SessionType,
} from 'src/shared/types'
import { createModelDependencies } from '@/adapters'
import BaseConfig from './base-config'
import type { ModelSettingUtil } from './interface'

export default class GroqSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.Groq
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `Groq API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const model: ProviderModelInfo = settings.models?.[0] || { modelId: 'llama3-8b-8192' }
    const dependencies = await createModelDependencies()
    const groq = new Groq(
      {
        apiKey: settings.apiKey!,
        model,
        temperature: 0,
      },
      dependencies
    )
    return groq.listModels()
  }
}
