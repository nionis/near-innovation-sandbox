import { fetchAvailableModels } from '@repo/packages-near-ai-provider'
import type {
  ModelProvider,
  ProviderModelInfo,
  ProviderSettings,
  SessionType,
} from 'src/shared/types'
import { ModelProviderEnum } from 'src/shared/types'
import BaseConfig from './base-config'
import type { ModelSettingUtil } from './interface'

export default class NearAISettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.NearAI

  async getCurrentModelDisplayName(
    model: string,
    _sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    return `NEAR AI (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings): Promise<ProviderModelInfo[]> {
    if (!settings.apiKey) return []
    const ids = await fetchAvailableModels(settings.apiKey, {
      nearAiBaseUrl: settings.apiHost,
    })
    return ids.map((modelId) => ({ modelId, type: 'chat' as const }))
  }
}
