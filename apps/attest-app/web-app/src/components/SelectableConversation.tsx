import { useRef, useState, useMemo } from 'react'
import type { AttestationChatData } from '@/stores/attestation-store'
import { decryptMessages } from '@/lib/conversation-serializer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SelectableConversationProps {
  chatData: AttestationChatData
  onTextSelected: (
    messageIndex: number,
    startChar: number,
    endChar: number,
    selectedText: string
  ) => void
}

export function SelectableConversation({
  chatData,
  onTextSelected,
}: SelectableConversationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [selectedRange, setSelectedRange] = useState<{
    messageIndex: number
    start: number
    end: number
    text: string
  } | null>(null)

  const messages = useMemo(() => decryptMessages(chatData), [chatData])

  const handleMouseUp = (messageIndex: number) => {
    const messageRef = messageRefs.current.get(messageIndex)
    if (!messageRef) return

    const selection = window.getSelection()
    if (!selection || selection.toString().length === 0) {
      setSelectedRange(null)
      return
    }

    try {
      const range = selection.getRangeAt(0)

      // Check if selection is within this specific message
      if (!messageRef.contains(range.commonAncestorContainer)) {
        setSelectedRange(null)
        return
      }

      const preSelectionRange = range.cloneRange()
      preSelectionRange.selectNodeContents(messageRef)
      preSelectionRange.setEnd(range.startContainer, range.startOffset)

      const startChar = preSelectionRange.toString().length
      const endChar = startChar + selection.toString().length

      setSelectedRange({
        messageIndex,
        start: startChar,
        end: endChar,
        text: selection.toString(),
      })
    } catch (error) {
      console.error('Error calculating selection range:', error)
      setSelectedRange(null)
    }
  }

  const handleCreateReference = () => {
    if (selectedRange) {
      onTextSelected(
        selectedRange.messageIndex,
        selectedRange.start,
        selectedRange.end,
        selectedRange.text
      )
      setSelectedRange(null)
      // Clear selection
      window.getSelection()?.removeAllRanges()
    }
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className={cn(
          'border rounded-lg max-h-96 overflow-y-auto',
          selectedRange && 'ring-2 ring-primary/20'
        )}
      >
        <div className="space-y-3 p-4">
          {messages.map((message, index) => (
            <div
              key={index}
              ref={(el) => {
                if (el) {
                  messageRefs.current.set(index, el)
                } else {
                  messageRefs.current.delete(index)
                }
              }}
              onMouseUp={() => handleMouseUp(index)}
              className="!select-text cursor-text"
            >
              <div className="flex items-start gap-2 mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  {message.role === 'user' && '👤 User'}
                  {message.role === 'assistant' && '🤖 Assistant'}
                  {message.role === 'system' && '⚙️ System'}
                  {message.role !== 'user' &&
                    message.role !== 'assistant' &&
                    message.role !== 'system' &&
                    `${message.role}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  (Message #{index})
                </span>
              </div>
              <div className="text-sm whitespace-pre-wrap wrap-break-word pl-6">
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedRange && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          <div className="flex-1 text-xs">
            <p className="text-muted-foreground">
              Selected: Message #{selectedRange.messageIndex}, chars{' '}
              {selectedRange.start}-{selectedRange.end} (
              {selectedRange.text.length} chars)
            </p>
            <p className="mt-1 truncate">
              {selectedRange.text.slice(0, 100)}
              {selectedRange.text.length > 100 ? '...' : ''}
            </p>
          </div>
          <Button size="sm" onClick={handleCreateReference}>
            Create Reference
          </Button>
        </div>
      )}
    </div>
  )
}
