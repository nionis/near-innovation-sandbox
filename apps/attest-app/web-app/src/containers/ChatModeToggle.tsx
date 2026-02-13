import { cn } from '@/lib/utils'
import { IconMessageCircle, IconShieldCheck, IconHelp } from '@tabler/icons-react'

export type ChatMode = 'chat' | 'verify' | 'how'

interface ChatModeToggleProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  disabled?: boolean
}

export function ChatModeToggle({
  mode,
  onModeChange,
  disabled,
}: ChatModeToggleProps) {
  return (
    <div className="flex items-center justify-center mb-2">
      <div className="inline-flex items-center gap-0.5 p-1 bg-muted rounded-full">
        <button
          onClick={() => onModeChange('chat')}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 outline-none',
            mode === 'chat'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <IconMessageCircle size={14} />
          Chat
        </button>
        <button
          onClick={() => onModeChange('verify')}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 outline-none',
            mode === 'verify'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <IconShieldCheck size={14} />
          Verify & Share
        </button>
        <button
          onClick={() => onModeChange('how')}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 outline-none',
            mode === 'how'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <IconHelp size={14} />
          How
        </button>
      </div>
    </div>
  )
}
