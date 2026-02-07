import Gemini from 'src/shared/models/gemini'
import { type ModelProvider, ModelProviderEnum, type ProviderSettings, type SessionType } from 'src/shared/types'
import { createModelDependencies } from '@/adapters'
import BaseConfig from './base-config'
import type { ModelSettingUtil } from './interface'

export default class GeminiSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.Gemini
  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `Gemini API (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  public getLocalOptionGroups() {
    return []
  }

  protected async listProviderModels(settings: ProviderSettings) {
    const model = settings.models?.[0] || { modelId: 'gemini-2.0-flash' }
    const dependencies = await createModelDependencies()
    const gemini = new Gemini({
      geminiAPIHost: settings.apiHost!,
      geminiAPIKey: settings.apiKey!,
      model,
      temperature: 0,
    }, dependencies)
    return gemini.listModels()
  }
}
