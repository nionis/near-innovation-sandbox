import * as Sentry from '@sentry/react'
import { Tiktoken } from 'js-tiktoken/lite'
// @ts-ignore
import cl100k_base from 'js-tiktoken/ranks/cl100k_base'
import type { Message } from '../../shared/types'
import { TOKEN_CACHE_KEYS, type TokenCacheKey } from '../../shared/types/session'
import { getMessageText, isEmptyMessage } from '../../shared/utils/message'

const encoding = new Tiktoken(cl100k_base)

// DeepSeek tokenizer implementation
// https://api-docs.deepseek.com/zh-cn/quick_start/token_usage
function estimateDeepSeekTokens(text: string): number {
  let total = 0
  let prevSpace = false

  for (const char of text) {
    // Check if character is Chinese (CJK Unified Ideographs)
    if (
      /[\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\uf900-\ufaff\u2f800-\u2fa1f]/.test(
        char
      )
    ) {
      // Chinese character ≈ 0.6 token
      total += 0.6
      prevSpace = false
    } else if (/\s/.test(char)) {
      // Space counts as 1 token
      // if previous character is not a space, add 1 token
      if (!prevSpace) {
        total += 1
        prevSpace = true
      }
    } else if (/[a-zA-Z0-9]/.test(char) || /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/.test(char)) {
      // English character/number/symbol ≈ 0.3 token
      total += 0.3
      prevSpace = false
    } else {
      // Other characters
      total += 0.3
      prevSpace = false
    }
  }

  // Round up to nearest integer, minimum 1
  return Math.max(Math.ceil(total), 1)
}

// Model type for token counting
type TokenModel =
  | {
      provider: string
      modelId: string
    }
  | null
  | undefined

// Check if model is DeepSeek
export function isDeepSeekModel(model?: TokenModel): boolean {
  if (!model) return false
  const modelId = model.modelId?.toLowerCase() || ''
  return modelId.includes('deepseek')
}

// Get token cache key based on model
export function getTokenCacheKey(model?: TokenModel): TokenCacheKey {
  if (isDeepSeekModel(model)) {
    return TOKEN_CACHE_KEYS.deepseek
  }
  return TOKEN_CACHE_KEYS.default
}

// Helper function to get token count from file or link
export function getTokenCountForModel(item: { tokenCountMap?: Record<string, number> }, model?: TokenModel): number {
  const tokenCacheKey = getTokenCacheKey(model)

  // Use model-specific token count if available
  if (item.tokenCountMap?.[tokenCacheKey]) {
    return item.tokenCountMap[tokenCacheKey]
  }

  return 0
}

export function estimateTokens(str: string, model?: TokenModel): number {
  try {
    str = typeof str === 'string' ? str : JSON.stringify(str)

    // Use DeepSeek tokenizer for DeepSeek models
    if (isDeepSeekModel(model)) {
      return estimateDeepSeekTokens(str)
    }

    // Use default tokenizer for other models
    const tokens = encoding.encode(str)
    return tokens.length
  } catch (e) {
    Sentry.captureException(e)
    return 0
  }
}

// 参考: https://github.com/pkoukk/tiktoken-go#counting-tokens-for-chat-api-calls
// OpenAI Cookbook: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
export function estimateTokensFromMessages(
  messages: Message[],
  type = 'output' as 'output' | 'input',
  model?: TokenModel
) {
  if (messages.length === 0) {
    return 0
  }
  try {
    const tokensPerMessage = 3
    const tokensPerName = 1
    let ret = 0
    for (const msg of messages) {
      if (isEmptyMessage(msg)) {
        continue
      }
      ret += tokensPerMessage
      ret += estimateTokens(getMessageText(msg, false, type === 'output'), model)
      ret += estimateTokens(msg.role, model)
      if (msg.name) {
        ret += estimateTokens(msg.name, model)
        ret += tokensPerName
      }

      // Add token counts from files
      if (msg.files?.length) {
        for (const file of msg.files) {
          const fileTokenCount = getTokenCountForModel(file, model)
          if (fileTokenCount > 0) {
            ret += fileTokenCount
          }
        }
      }

      // Add token counts from links
      if (msg.links?.length) {
        for (const link of msg.links) {
          const linkTokenCount = getTokenCountForModel(link, model)
          if (linkTokenCount > 0) {
            ret += linkTokenCount
          }
        }
      }
    }
    // ret += 3 // every reply is primed with <|start|>assistant<|message|>
    return ret
  } catch (e) {
    Sentry.captureException(e)
    return 0
  }
}

export function sliceTextByTokenLimit(text: string, limit: number, model?: TokenModel) {
  let ret = ''
  let retTokenCount = 0
  const STEP_LEN = 100
  while (text.length > 0) {
    const part = text.slice(0, STEP_LEN)
    text = text.slice(STEP_LEN)
    const partTokenCount = estimateTokens(part, model)
    if (retTokenCount + partTokenCount > limit) {
      break
    }
    ret += part
    retTokenCount += partTokenCount
  }
  return ret
}
