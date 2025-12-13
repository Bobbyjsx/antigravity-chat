"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useConversations, useCreateConversation, useCreateGroupConversation } from "@/api/conversations";
import { useViewer } from "@/api/users";
import { useSignOut } from "@/api/auth";
import { useRealtimeConversations } from "@/hooks/use-realtime-conversations";
import toast from "react-hot-toast";
import { getServerError } from "@/lib/https";
import { SearchBar } from "./Sidebar/SearchBar";
import { ConversationList } from "./Sidebar/ConversationList";
import { NewChatDialog } from "./Sidebar/NewChatDialog";
import { UserProfile } from "./Sidebar/UserProfile";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: conversations, isLoading } = useConversations();

  const { mutateAsync: createConversation, isPending: isCreatingDirect } = useCreateConversation();
  const { mutateAsync: createGroupConversation, isPending: isCreatingGroup } = useCreateGroupConversation();
  const { data: viewer } = useViewer();
  const { mutateAsync: signOut } = useSignOut();
  
  // Enable realtime conversation updates
  useRealtimeConversations(viewer?.id);
  
  const [searchTerm, setSearchTerm] = useState("");
  const activeConversationId = pathname.split("/").pop();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/auth");
    } catch (error) {
      const errMsg = getServerError(error);
      toast.error(errMsg);
    }
  };

  const onSelectConversation = (conversationId: string) => {
    if (pathname !== `/chat/${conversationId}`) {
      router.push(`/chat/${conversationId}`);
    }
  };
  
  const handleCreateChat = async (userId: string) => {
    try {
      const conversationId = await createConversation(userId);
      onSelectConversation(conversationId);
    } catch (error) {
      const errMsg = getServerError(error);
      toast.error(errMsg);
    }
  };

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    try {
      const conversationId = await createGroupConversation({ name, memberIds });
      onSelectConversation(conversationId);
    } catch (error) {
      const errMsg = getServerError(error);
      toast.error(errMsg);
    }
  };

  const handleViewProfile = () => {
    router.push("/profile");
  };

  // Filter conversations based on search term
  const filteredConversations = conversations?.filter((conversation) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    if (conversation.is_group) {
      return conversation.name?.toLowerCase().includes(searchLower);
    }
    return conversation.other_user?.name?.toLowerCase().includes(searchLower) ||
           conversation.other_user?.email?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="w-full sm:w-96 bg-gray-900 border-r border-gray-800 flex flex-col h-full min-h-[100dvh] overflow-y-auto">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">Messages</h2>
        <div className="space-y-3">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-400">Loading conversations...</div>
          </div>
        ) : conversations?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-gray-400 mb-2">No conversations yet</p>
            <p className="text-sm text-gray-500">Start a new chat to get started</p>
          </div>
        ) : (
          <ConversationList
            conversations={filteredConversations || []}
            activeConversationId={activeConversationId}
            isLoading={false}
            onSelectConversation={onSelectConversation}
          />
        )}
        {!isLoading && searchTerm && filteredConversations?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <p>No conversations found</p>
          </div>
        )}
      </div>
      <NewChatDialog
        onCreateDirectChat={handleCreateChat}
        onCreateGroupChat={handleCreateGroup}
        isCreatingDirect={isCreatingDirect}
        isCreatingGroup={isCreatingGroup}
      />
      <UserProfile onSignOut={handleSignOut} onViewProfile={handleViewProfile} />
    </div>
  );
}
