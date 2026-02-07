import { useDebouncedValue } from '@mantine/hooks'
import { type UseQueryOptions, useQueries } from '@tanstack/react-query'
import { sum } from 'lodash'
import { useEffect, useMemo, useState } from 'react'
import { estimateTokensFromMessages, isDeepSeekModel } from '@/packages/token'
import queryClient from '@/stores/queryClient'
import { type Message, type MessageTokenCountResult, TOKEN_CACHE_KEYS } from '../../shared/types'
import * as chatStore from '../stores/chatStore'

async function saveMessageTokenCount(sessionId: string, calcResults: MessageTokenCountResult[]) {
  // mark queries result as reused when saved to storage, prevent re-calculation
  const messageIds = calcResults.map((mu) => mu.id)
  queryClient.setQueriesData(
    {
      predicate: (query) =>
        query.queryKey[0] === 'message-token-count' && messageIds.includes(String(query.queryKey[1])),
    },
    (data: MessageTokenCountResult) => {
      return { ...data, reused: true }
    }
  )

  // save calculated token count to storage
  await chatStore.updateMessages(sessionId, (messages) => {
    if (!messages) {
      throw new Error('messages is null')
    }
    return messages.map((m) => {
      const update = calcResults.find((mu) => mu.id === m.id)
      if (update) {
        return {
          ...m,
          tokenCountMap: update.tokenCountMap,
        }
      }
      return m
    })
  })
}

// get estimated token count for a list of context messages, save to message storage for later reuse
export function useMessagesTokenCountQuery(
  sessionId: string | null,
  messageIds: string[] | null,
  model?: { provider: string; modelId: string }
) {
  const { session, refetch } = chatStore.useSession(sessionId)

  const results = useQueries({
    queries:
      messageIds?.map((id) => {
        return {
          queryKey: ['message-token-count', id],
          queryFn: () => {
            if (!session) {
              return null
            }
            // only calculate token count for messages in current session
            const m = session.messages.find((msg) => msg.id === id)
            if (!m) {
              return null
            }
            if (m.tokenCountMap) {
              return { id: m.id, tokenCountMap: m.tokenCountMap, reused: true }
            } else {
              console.debug('useTokenCount', 'count token for message', m.id)
              return {
                id: m.id,
                tokenCountMap: {
                  deepseek: estimateTokensFromMessages([m], 'input', { modelId: 'deepseek', provider: '' }),
                  default: estimateTokensFromMessages([m], 'input'),
                },
                reused: false,
              }
            }
          },
          enabled: !!sessionId && !!messageIds,
          // currently this cache is not updated after message content edited
          staleTime: 30 * 1000, // 30 seconds
        } satisfies UseQueryOptions
      }) || [],
  })

  useEffect(() => {
    if (!sessionId || sessionId === 'new') {
      return
    }
    // need to write to storage
    const newCalcResults = results
      .filter((result) => result.data?.tokenCountMap && !result.data?.reused)
      .map((m) => m.data!)

    if (newCalcResults.length === 0) {
      return
    }
    // save to storage and refetch session, prevent queryFn accessing stale session data to avoid infinite loop
    void saveMessageTokenCount(sessionId, newCalcResults).then(() => refetch())
  }, [results, sessionId, refetch])

  const tokenCount = useMemo(() => {
    return sum(
      results.map((r) => {
        if (isDeepSeekModel(model)) {
          return r.data?.tokenCountMap?.[TOKEN_CACHE_KEYS.deepseek] ?? 0
        }
        return r.data?.tokenCountMap?.[TOKEN_CACHE_KEYS.default] ?? 0
      })
    )
  }, [results, model])

  return tokenCount
}

export function useTokenCount(
  sessionId: string | null,
  constructedMessage: Message | undefined,
  messageIds: string[] | null,
  model?: { provider: string; modelId: string }
) {
  const [currentInputTokens, setCurrentInputTokens] = useState(0)

  const contextTokens = useMessagesTokenCountQuery(sessionId, messageIds, model)

  const [debouncedConstructedMessage] = useDebouncedValue(constructedMessage, 300)

  useEffect(() => {
    if (!debouncedConstructedMessage) {
      setCurrentInputTokens(0)
      return
    } else {
      console.debug('useTokenCount', 'calculate current input tokens')
      setCurrentInputTokens(
        estimateTokensFromMessages([debouncedConstructedMessage], 'input', {
          modelId: model?.modelId || '',
          provider: model?.provider || '',
        })
      )
    }
  }, [debouncedConstructedMessage, model?.modelId, model?.provider])

  return {
    currentInputTokens,
    contextTokens,
    totalTokens: currentInputTokens + contextTokens,
  }
}
