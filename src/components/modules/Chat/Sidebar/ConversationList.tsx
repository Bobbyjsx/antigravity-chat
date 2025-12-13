import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar";
import type { ConversationWithUser } from "@/api/types";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";

interface ConversationListProps {
  conversations: ConversationWithUser[];
  activeConversationId?: string;
  isLoading: boolean;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  isLoading,
  onSelectConversation,
}: ConversationListProps) {
  const onlineUsers = useOnlineUsers();

  console.log({onlineUsers})
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading conversations...</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MessageSquare className="w-12 h-12 text-gray-600 mb-3" />
        <p className="text-gray-400 mb-2">No conversations yet</p>
        <p className="text-sm text-gray-500">Start a new chat to get started</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full gap-2">
      {conversations.map((conversation) => {
        const displayName = conversation.is_group
          ? conversation.name
          : conversation.other_user?.name || "Unknown User";
        
        const avatarUrl = conversation.is_group
          ? conversation.group_image
          : conversation.other_user?.image;
        
        const fallbackText = conversation.is_group
          ? conversation.name?.[0] || "G"
          : conversation.other_user?.name?.[0] || "U";

        const isOnline = !conversation.is_group && conversation.other_user?.id && onlineUsers.has(conversation.other_user.id);
        const hasLeft = !!conversation.left_at;

        return (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation.id)}
            className={cn(
              "w-full p-4 flex items-center gap-3 transition-colors text-left border-l-4 !bg-gray-800",
              activeConversationId === conversation.id
                ? "!bg-gray-900 !border-blue-500"
                : "border-transparent hover:bg-gray-800/50",
              hasLeft && "opacity-60 grayscale"
            )}
          >
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold">
                  {fallbackText}
                </AvatarFallback>
              </Avatar>
              {isOnline && !hasLeft && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white truncate max-w-[180px] flex items-center gap-2">
                  {displayName}
                  {hasLeft && (
                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                      Left
                    </span>
                  )}
                </h3>
                {conversation.last_message_time && (
                  <span className="text-xs text-gray-500">
                    {new Date(conversation.last_message_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 truncate">
               {hasLeft ? "You left this group" : (conversation?.last_message?.content || "Click to view messages")}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
