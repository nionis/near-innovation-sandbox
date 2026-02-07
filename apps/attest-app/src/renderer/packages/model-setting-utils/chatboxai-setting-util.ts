import {
  type ModelProvider,
  ModelProviderEnum,
  type ProviderModelInfo,
  type ProviderSettings,
  type SessionType,
} from 'src/shared/types'
import BaseConfig from './base-config'
import type { ModelSettingUtil } from './interface'

export default class ChatboxAISettingUtil extends BaseConfig implements ModelSettingUtil {
  public provider: ModelProvider = ModelProviderEnum.ChatboxAI

  async getCurrentModelDisplayName(
    model: string,
    sessionType: SessionType,
    providerSettings?: ProviderSettings
  ): Promise<string> {
    if (sessionType === 'picture') {
      return `Chatbox AI`
    } else {
      return `Chatbox AI (${providerSettings?.models?.find((m) => m.modelId === model)?.nickname || model})`
    }
  }

  protected async listProviderModels() {
    return []
  }

  protected mergeOptionGroups(localModels: ProviderModelInfo[], remoteModels: ProviderModelInfo[]) {
    const modelMap = new Map<string, ProviderModelInfo>()

    // 先添加远程模型
    for (const model of remoteModels) {
      modelMap.set(model.modelId, model)
    }

    // 本地模型覆盖远程模型
    for (const model of localModels) {
      modelMap.set(model.modelId, model)
    }

    return Array.from(modelMap.values())
  }
}
