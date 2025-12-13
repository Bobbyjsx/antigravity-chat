import { ChatMessage } from "@/hooks/use-realtime-chat"
import { cn } from "@/lib/utils"
import { Check, CheckCheck, Clock } from 'lucide-react'

interface ChatMessageItemProps {
  message: ChatMessage
  isOwnMessage: boolean
  showHeader: boolean
}

export const ChatMessageItem = ({ message, isOwnMessage, showHeader }: ChatMessageItemProps) => {
  return (
    <div className={`flex mt-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={cn('max-w-[75%] w-fit flex flex-col gap-1', {
          'items-end': isOwnMessage,
        })}
      >
        {showHeader && (
          <div
            className={cn('flex items-center gap-2 text-xs px-3', {
              'justify-end flex-row-reverse': isOwnMessage,
            })}
          >
            <span className={'font-medium'}>{message.user.name}</span>
          </div>
        )}
        <div
          className={cn(
            'py-2 px-3 rounded-xl text-sm w-fit flex flex-col gap-1 min-w-[80px]',
            isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted text-gray-900'
          )}
        >
          <span>{message.content}</span>
          <div className={cn("flex items-center gap-1 text-[10px] opacity-70 self-end")}>
            <span>
              {new Date(message.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
            {isOwnMessage && (
              <span className="ml-1">
                {message.isOptimistic ? (
                  <Clock className="w-3 h-3" />
                ) : message.seen_at ? (
                  <CheckCheck className="w-3 h-3 text-blue-500" />
                ) : message.delivered_at ? (
                  <CheckCheck className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
