import CustomClaude from 'src/shared/models/custom-claude'
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

export default class CustomClaudeSettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderType.Claude

  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings,
    providerBaseInfo?: ProviderBaseInfo
  ): Promise<string> {
    const providerName = providerBaseInfo?.name ?? 'Custom Claude'
    const nickname = providerSettings?.models?.find((m) => m.modelId === model)?.nickname
    return `${providerName} (${nickname || model})`
  }

  protected async listProviderModels(settings: ProviderSettings) {
    // Use the first model as default if no models configured
    const model = settings.models?.[0] || { modelId: 'claude-3-5-sonnet-20241022' }

    const dependencies = await createModelDependencies()
    const customClaude = new CustomClaude(
      {
        apiHost: settings.apiHost!,
        apiKey: settings.apiKey!,
        model,
        temperature: 0,
      },
      dependencies
    )

    return customClaude.listModels()
  }
}
