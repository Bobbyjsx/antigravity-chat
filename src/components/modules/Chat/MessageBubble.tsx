import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { Message } from "@/api/types";

export function MessageBubble({
  message,
  isMe,
  senderName,
  showSenderName = false,
}: {
  message: Message;
  isMe: boolean;
  senderName?: string;
  showSenderName?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full mb-4",
        isMe ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2",
          isMe
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-700 text-white rounded-bl-none",
          message._isOptimistic && "opacity-60"
        )}
      >
        {showSenderName && !isMe && senderName && (
          <p className="text-xs text-blue-300 font-medium mb-1">{senderName}</p>
        )}
        <p>{message.content}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[10px] opacity-70">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isMe && !message._isOptimistic && (
            <span className="text-[10px] opacity-70">
              {message.seen_at ? (
                <CheckCheck className="w-3 h-3 text-blue-300" />
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
  );
}
