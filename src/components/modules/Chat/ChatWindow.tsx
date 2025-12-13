"use client";

import { useViewer } from "@/api/users";
import { ArrowLeft, Video } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCall } from "@/contexts/CallContext";
import { ChatSettings } from "./ChatSettings";
import { useMessages } from "@/api/messages";
import { RealtimeChat } from "@components/ui/realtime-chat";
import { useConversation, useConversationMembers } from "@/api/conversations";
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";

export function ChatWindow({ conversationId }: { conversationId: string }) {
  const { data: me } = useViewer();
  const { data: messages = [] } = useMessages(conversationId);
  const { data: conversation, isLoading: loadingConversation } = useConversation(conversationId);
  const { data: membersData = [] } = useConversationMembers(conversationId);
  const onlineUsers = useOnlineUsers();
  const { startCall } = useCall();
   
  if (!me) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>;
  };

  if (loadingConversation) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Loading conversation...</div>;
  };

  const avatarUrl = conversation?.is_group 
    ? conversation?.group_image 
    : conversation?.user?.image; 
  
  const displayName = conversation?.name || conversation?.user?.name || "Chat";
  const fallbackText = conversation?.is_group 
    ? displayName[0] || "#" 
    : displayName[0] || "C";
  
  const members = membersData.reduce((acc: Record<string, { name: string; image?: string }>, member: any) => {
    if (member.users) {
      acc[member.user_id] = {
        name: member.users.name || member.users.email || 'Unknown',
        image: member.users.avatar_url
      };
    }
    return acc;
  }, {} as Record<string, { name: string; image?: string }>);

  const isOnline = !conversation?.is_group && conversation?.user?.id && onlineUsers.has(conversation.user.id);

  return (
    <div className="flex-1 flex flex-col h-[90dvh] min-h-[100dvh] bg-gray-900 justify-between overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="sm:hidden -ml-2 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Avatar className="w-10 h-10">
            <AvatarImage src={avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold">
              {fallbackText}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-bold text-white">{displayName}</h3>
            {isOnline && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-green-500 font-medium">Online</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          {!conversation?.is_group && conversation?.user && (
            <Button
              variant="ghost" 
              size="icon"
              className="text-gray-400 hover:text-white"
              onClick={() => startCall(conversation.user!)}
            >
              <Video className="w-5 h-5" />
            </Button>
          )}
          <ChatSettings
            conversationId={conversationId}
            conversationName={conversation?.name}
            isGroup={conversation?.is_group || false}
            groupImage={conversation?.group_image}
            hasLeft={!!conversation?.left_at}
          />
        </div>
      </div>

      {/* Realtime Chat Component */}
      <RealtimeChat
        conversationId={conversationId}
        userId={me.id}
        username={me.name || me.email}
        initialMessages={messages}
        isGroup={conversation?.is_group}
        members={members}
        hasLeft={!!conversation?.left_at}
      />
    </div>
  );
}
