import { pick } from 'lodash'
import type {
  ExportChatFormat,
  ExportChatScope,
  Session,
  SessionMeta,
  SessionSettings,
  SessionThread,
  SessionThreadBrief,
  Settings,
} from 'src/shared/types'
import { getMessageText, migrateMessage } from 'src/shared/utils/message'
import i18n from '@/i18n'
import { formatChatAsHtml, formatChatAsMarkdown, formatChatAsTxt } from '@/lib/format-chat'
import * as localParser from '@/packages/local-parser'
import * as remote from '@/packages/remote'
import { estimateTokens } from '@/packages/token'
import platform from '@/platform'
import storage from '@/storage'
import { StorageKey, StorageKeyGenerator } from '@/storage/StoreStorage'
import { migrateSession, sortSessions } from '@/utils/session-utils'
import * as defaults from '../../shared/defaults'
import { createMessage, type Message, SessionSettingsSchema, TOKEN_CACHE_KEYS } from '../../shared/types'
import { lastUsedModelStore } from './lastUsedModelStore'
import * as settingActions from './settingActions'
import { settingsStore } from './settingsStore'
/**
 * 预处理文件以获取内容和存储键
 * @param file 文件对象
 * @param settings 会话设置
 * @param tokenLimit 每个文件的token限制
 * @returns 预处理后的文件信息
 */
export async function preprocessFile(
  file: File,
  settings: SessionSettings
): Promise<{
  file: File
  content: string
  storageKey: string
  tokenCountMap?: Record<string, number>
  error?: string
}> {
  const remoteConfig = settingActions.getRemoteConfig()

  try {
    const isPro = settingActions.isPro()
    const uniqKey = StorageKeyGenerator.fileUniqKey(file)

    // 检查是否已经处理过这个文件
    const existingContent = await storage.getBlob(uniqKey).catch(() => null)
    if (existingContent) {
      // Get existing token map or create new one
      const existingTokenMap: Record<string, number> = (await storage.getItem(`${uniqKey}_tokenMap`, {})) as Record<
        string,
        number
      >

      // Calculate tokens for both tokenizers if not cached
      if (!existingTokenMap[TOKEN_CACHE_KEYS.default]) {
        existingTokenMap[TOKEN_CACHE_KEYS.default] = estimateTokens(existingContent)
      }
      if (!existingTokenMap[TOKEN_CACHE_KEYS.deepseek]) {
        existingTokenMap[TOKEN_CACHE_KEYS.deepseek] = estimateTokens(existingContent, {
          provider: '',
          modelId: 'deepseek',
        })
      }

      // Save updated token map if changes were made
      if (!existingTokenMap[TOKEN_CACHE_KEYS.default] || !existingTokenMap[TOKEN_CACHE_KEYS.deepseek]) {
        await storage.setItem(`${uniqKey}_tokenMap`, existingTokenMap)
      }

      return {
        file,
        content: existingContent,
        storageKey: uniqKey,
        tokenCountMap: existingTokenMap,
      }
    }

    if (isPro) {
      // ChatboxAI 方案：上传文件并获取内容
      const licenseKey = settingActions.getLicenseKey()
      const uploadedKey = await remote.uploadAndCreateUserFile(licenseKey || '', file)

      // 获取上传后的文件内容（如果可用）
      const content = (await storage.getBlob(uploadedKey).catch(() => '')) || ''

      // 将内容存储到唯一键下
      if (content) {
        await storage.setBlob(uniqKey, content)
      }

      // Calculate token counts for both tokenizers
      const tokenCountMap: Record<string, number> = content
        ? {
            [TOKEN_CACHE_KEYS.default]: estimateTokens(content),
            [TOKEN_CACHE_KEYS.deepseek]: estimateTokens(content, { provider: '', modelId: 'deepseek' }),
          }
        : {}

      // Store token map for future use
      if (content) {
        await storage.setItem(`${uniqKey}_tokenMap`, tokenCountMap)
      }

      return {
        file,
        content,
        storageKey: uniqKey,
        tokenCountMap,
      }
    } else {
      // 本地方案：解析文件内容
      const result = await platform.parseFileLocally(file)
      if (!result.isSupported || !result.key) {
        if (platform.type === 'mobile') {
          throw new Error('mobile_not_support_local_file_parsing')
        }
        // 根据当前 IP，判断是否在错误中推荐 Chatbox AI
        if (remoteConfig.setting_chatboxai_first) {
          throw new Error('model_not_support_file')
        } else {
          throw new Error('model_not_support_file_2')
        }
      }

      // 从临时存储中获取文件内容
      const content = (await storage.getBlob(result.key).catch(() => '')) || ''

      // 将内容存储到唯一键下
      if (content) {
        await storage.setBlob(uniqKey, content)
      }

      // Calculate token counts for both tokenizers
      const tokenCountMap: Record<string, number> = content
        ? {
            [TOKEN_CACHE_KEYS.default]: estimateTokens(content),
            [TOKEN_CACHE_KEYS.deepseek]: estimateTokens(content, { provider: '', modelId: 'deepseek' }),
          }
        : {}

      // Store token map for future use
      if (content) {
        await storage.setItem(`${uniqKey}_tokenMap`, tokenCountMap)
      }

      return {
        file,
        content,
        storageKey: uniqKey,
        tokenCountMap,
      }
    }
  } catch (error) {
    return {
      file,
      content: '',
      storageKey: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 预处理链接以获取内容
 * @param url 链接地址
 * @param settings 会话设置
 * @returns 预处理后的链接信息
 */
export async function preprocessLink(
  url: string,
  settings: SessionSettings
): Promise<{
  url: string
  title: string
  content: string
  storageKey: string
  tokenCountMap?: Record<string, number>
  error?: string
}> {
  try {
    const isPro = settingActions.isPro()
    const uniqKey = StorageKeyGenerator.linkUniqKey(url)

    // 检查是否已经处理过这个链接
    const existingContent = await storage.getBlob(uniqKey).catch(() => null)
    if (existingContent) {
      // 如果已经有内容，尝试从内容中提取标题
      const titleMatch = existingContent.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = titleMatch ? titleMatch[1] : url.replace(/^https?:\/\//, '')

      // Get existing token map or create new one
      const existingTokenMap: Record<string, number> = (await storage.getItem(`${uniqKey}_tokenMap`, {})) as Record<
        string,
        number
      >

      // Calculate tokens for both tokenizers if not cached
      if (!existingTokenMap[TOKEN_CACHE_KEYS.default]) {
        existingTokenMap[TOKEN_CACHE_KEYS.default] = estimateTokens(existingContent)
      }
      if (!existingTokenMap[TOKEN_CACHE_KEYS.deepseek]) {
        existingTokenMap[TOKEN_CACHE_KEYS.deepseek] = estimateTokens(existingContent, {
          provider: '',
          modelId: 'deepseek',
        })
      }

      // Save updated token map if changes were made
      if (!existingTokenMap[TOKEN_CACHE_KEYS.default] || !existingTokenMap[TOKEN_CACHE_KEYS.deepseek]) {
        await storage.setItem(`${uniqKey}_tokenMap`, existingTokenMap)
      }

      return {
        url,
        title,
        content: existingContent,
        storageKey: uniqKey,
        tokenCountMap: existingTokenMap,
      }
    }

    if (isPro) {
      // ChatboxAI 方案：使用远程解析
      const licenseKey = settingActions.getLicenseKey()
      const parsed = await remote.parseUserLinkPro({ licenseKey: licenseKey || '', url })

      // 获取解析后的内容
      const content = (await storage.getBlob(parsed.storageKey).catch(() => '')) || ''

      // 将内容存储到唯一键下
      if (content) {
        await storage.setBlob(uniqKey, content)
      }

      // Calculate token counts for both tokenizers
      const tokenCountMap: Record<string, number> = content
        ? {
            [TOKEN_CACHE_KEYS.default]: estimateTokens(content),
            [TOKEN_CACHE_KEYS.deepseek]: estimateTokens(content, { provider: '', modelId: 'deepseek' }),
          }
        : {}

      // Store token map for future use
      if (content) {
        await storage.setItem(`${uniqKey}_tokenMap`, tokenCountMap)
      }

      return {
        url,
        title: parsed.title,
        content,
        storageKey: uniqKey,
        tokenCountMap,
      }
    } else {
      // 本地方案：解析链接内容
      const { key, title } = await localParser.parseUrl(url)
      const content = (await storage.getBlob(key).catch(() => '')) || ''

      // 将内容存储到唯一键下
      if (content) {
        await storage.setBlob(uniqKey, content)
      }

      // Calculate token counts for both tokenizers
      const tokenCountMap: Record<string, number> = content
        ? {
            [TOKEN_CACHE_KEYS.default]: estimateTokens(content),
            [TOKEN_CACHE_KEYS.deepseek]: estimateTokens(content, { provider: '', modelId: 'deepseek' }),
          }
        : {}

      // Store token map for future use
      if (content) {
        await storage.setItem(`${uniqKey}_tokenMap`, tokenCountMap)
      }

      return {
        url,
        title,
        content,
        storageKey: uniqKey,
        tokenCountMap,
      }
    }
  } catch (error) {
    return {
      url,
      title: url.replace(/^https?:\/\//, ''),
      content: '',
      storageKey: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 构建用户消息，只包含元数据不包含内容
 * @param text 消息文本
 * @param pictureKeys 图片存储键列表
 * @param preprocessedFiles 预处理后的文件信息
 * @param preprocessedLinks 预处理后的链接信息
 * @returns 构建好的消息对象
 */
export function constructUserMessage(
  text: string,
  pictureKeys: string[] = [],
  preprocessedFiles: Array<{
    file: File
    content: string
    storageKey: string
    tokenCountMap?: Record<string, number>
  }> = [],
  preprocessedLinks: Array<{
    url: string
    title: string
    content: string
    storageKey: string
    tokenCountMap?: Record<string, number>
  }> = []
): Message {
  // 只使用原始文本，不添加文件和链接内容
  const msg = createMessage('user', text)

  // 添加图片
  if (pictureKeys.length > 0) {
    msg.contentParts = msg.contentParts ?? []
    msg.contentParts.push(...pictureKeys.map((k) => ({ type: 'image' as const, storageKey: k })))
  }

  // 添加附件元数据（只包含存储键，不包含内容）
  if (preprocessedFiles.length > 0) {
    msg.files = preprocessedFiles.map((f) => ({
      id: f.storageKey || f.file.name,
      name: f.file.name,
      fileType: f.file.type,
      storageKey: f.storageKey,
      tokenCountMap: f.tokenCountMap,
    }))
  }

  // 添加链接元数据（只包含存储键，不包含内容）
  if (preprocessedLinks.length > 0) {
    msg.links = preprocessedLinks.map((l) => ({
      id: l.storageKey || l.url,
      url: l.url,
      title: l.title,
      storageKey: l.storageKey,
      tokenCountMap: l.tokenCountMap,
    }))
  }

  return msg
}

export async function exportChat(session: Session, scope: ExportChatScope, format: ExportChatFormat) {
  const threads: SessionThread[] = scope === 'all_threads' ? [...(session.threads || [])] : []
  threads.push({
    id: session.id,
    name: session.threadName || session.name,
    messages: session.messages,
    createdAt: Date.now(),
  })

  if (format === 'Markdown') {
    const content = formatChatAsMarkdown(session.name, threads)
    platform.exporter.exportTextFile(`${session.name}.md`, content)
  } else if (format === 'TXT') {
    const content = formatChatAsTxt(session.name, threads)
    platform.exporter.exportTextFile(`${session.name}.txt`, content)
  } else if (format === 'HTML') {
    const content = await formatChatAsHtml(session.name, threads)
    platform.exporter.exportTextFile(`${session.name}.html`, content)
  }
}

export function mergeSettings(
  globalSettings: Settings,
  sessionSetting?: SessionSettings,
  sessionType?: 'picture' | 'chat'
): SessionSettings {
  if (!sessionSetting) {
    return SessionSettingsSchema.parse(globalSettings)
  }
  return SessionSettingsSchema.parse({
    ...globalSettings,
    ...(sessionType === 'picture'
      ? {
          imageGenerateNum: defaults.pictureSessionSettings().imageGenerateNum,
          dalleStyle: defaults.pictureSessionSettings().dalleStyle,
        }
      : {
          maxContextMessageCount: defaults.chatSessionSettings().maxContextMessageCount,
        }),
    ...sessionSetting,
  })
}

export function initEmptyChatSession(): Omit<Session, 'id'> {
  const settings = settingsStore.getState().getSettings()
  const { chat: lastUsedChatModel } = lastUsedModelStore.getState()
  const newSession: Omit<Session, 'id'> = {
    name: 'Untitled',
    type: 'chat',
    messages: [],
    settings: {
      maxContextMessageCount: settings.maxContextMessageCount || 6,
      temperature: settings.temperature || undefined,
      topP: settings.topP || undefined,
      ...(settings.defaultChatModel
        ? {
            provider: settings.defaultChatModel.provider,
            modelId: settings.defaultChatModel.model,
          }
        : lastUsedChatModel),
    },
  }
  if (settings.defaultPrompt) {
    newSession.messages.push(createMessage('system', settings.defaultPrompt || defaults.getDefaultPrompt()))
  }
  return newSession
}

export function initEmptyPictureSession(): Omit<Session, 'id'> {
  const { picture: lastUsedPictureModel } = lastUsedModelStore.getState()

  return {
    name: 'Untitled',
    type: 'picture',
    messages: [createMessage('system', i18n.t('Image Creator Intro') || '')],
    settings: {
      ...lastUsedPictureModel,
    },
  }
}

export function getSessionMeta(session: SessionMeta) {
  return pick(session, ['id', 'name', 'starred', 'assistantAvatarKey', 'picUrl', 'type'])
}

function _searchSessions(regexp: RegExp, s: Session) {
  const session = migrateSession(s)
  const matchedMessages: Message[] = []
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const message = session.messages[i]
    if (regexp.test(getMessageText(message))) {
      matchedMessages.push(message)
    }
  }
  // 搜索会话的历史主题
  if (session.threads) {
    for (let i = session.threads.length - 1; i >= 0; i--) {
      const thread = session.threads[i]
      for (let j = thread.messages.length - 1; j >= 0; j--) {
        const message = thread.messages[j]
        if (regexp.test(getMessageText(message))) {
          matchedMessages.push(message)
        }
      }
    }
  }
  return matchedMessages.map((m) => migrateMessage(m))
}

export async function searchSessions(searchInput: string, sessionId?: string, onResult?: (result: Session[]) => void) {
  const safeInput = searchInput.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
  const regexp = new RegExp(safeInput, 'i')
  let matchedMessageTotal = 0

  const emitBatch = (batch: Session[]) => {
    if (batch.length === 0) {
      return
    }
    onResult?.(batch)
  }

  if (sessionId) {
    const session = await storage.getItem<Session | null>(StorageKeyGenerator.session(sessionId), null)
    if (session) {
      const matchedMessages = _searchSessions(regexp, session)
      matchedMessageTotal += matchedMessages.length
      emitBatch([{ ...session, messages: matchedMessages }])
    }
  } else {
    const sessionsList = sortSessions(await storage.getItem<SessionMeta[]>(StorageKey.ChatSessionsList, []))

    for (const sessionMeta of sessionsList) {
      const session = await storage.getItem<Session | null>(StorageKeyGenerator.session(sessionMeta.id), null)
      if (session) {
        const messages = _searchSessions(regexp, session)
        if (messages.length > 0) {
          matchedMessageTotal += messages.length
          emitBatch([{ ...session, messages }])
        }
        if (matchedMessageTotal >= 50) {
          break
        }
      }
    }
  }
}

export function getCurrentThreadHistoryHash(s: Session) {
  const ret: { [firstMessageId: string]: SessionThreadBrief } = {}
  if (s.threads) {
    for (const thread of s.threads) {
      if (!thread.messages || thread.messages.length === 0) {
        continue
      }
      ret[thread.messages[0].id] = {
        id: thread.id,
        name: thread.name,
        createdAt: thread.createdAt,
        createdAtLabel: new Date(thread.createdAt).toLocaleString(),
        firstMessageId: thread.messages[0].id,
        messageCount: thread.messages.length,
      }
    }
    if (s.messages && s.messages.length > 0) {
      ret[s.messages[0].id] = {
        id: s.id,
        name: s.threadName || '',
        firstMessageId: s.messages[0].id,
        messageCount: s.messages.length,
      }
    }
  }
  return ret
}

export function getAllMessageList(s: Session) {
  let messageContext: Message[] = []
  if (s.threads) {
    for (const thread of s.threads) {
      messageContext = messageContext.concat(thread.messages)
    }
  }
  if (s.messages) {
    messageContext = messageContext.concat(s.messages)
  }
  return messageContext
}
