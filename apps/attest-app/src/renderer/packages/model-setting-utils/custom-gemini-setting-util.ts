import CustomGemini from 'src/shared/models/custom-gemini'
import {
  type ModelProvider,
  ModelProviderType,
  type ProviderBaseInfo,
  type ProviderSettings,
  type SessionType,
} from 'src/shared/types'
import { createModelDependencies } from '@/adapters'
import BaseConfig from './base-config'
import type { ModelSettingUtil } from './interface'

export default class CustomGeminiSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderType.Gemini

  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings,
    providerBaseInfo?: ProviderBaseInfo
  ): Promise<string> {
    const providerName = providerBaseInfo?.name ?? 'Custom Gemini'
    const nickname = providerSettings?.models?.find((m) => m.modelId === model)?.nickname
    return `${providerName} (${nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    // Use the first model as default if no models configured
    const model = settings.models?.[0] || { modelId: 'gemini-2.0-flash-exp' }

    const dependencies = await createModelDependencies()
    const customGemini = new CustomGemini(
      {
        apiHost: settings.apiHost!,
        apiKey: settings.apiKey!,
        model,
        temperature: 0,
      },
      dependencies
    )

    return customGemini.listModels()
  }
}
