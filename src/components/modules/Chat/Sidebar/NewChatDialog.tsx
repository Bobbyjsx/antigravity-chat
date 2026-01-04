import { Plus } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { DirectChatTab } from "./DirectChatTab";
import type { User } from "@/api/users";
import { GroupChatTab } from "./GroupChatTab";

interface NewChatDialogProps {
  onCreateDirectChat: (userId: string) => Promise<void>;
  onCreateGroupChat: (name: string, memberIds: string[]) => Promise<void>;
  isCreatingDirect?: boolean;
  isCreatingGroup?: boolean;
}

export function NewChatDialog({
  onCreateDirectChat,
  onCreateGroupChat,
  isCreatingDirect = false,
  isCreatingGroup = false,
}: NewChatDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupUserSearchTerm, setGroupUserSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  const handleCreateDirectChat = async (userId: string) => {
    await onCreateDirectChat(userId);
    setIsOpen(false);
    setUserSearchTerm("");
  };

  const handleCreateGroup = async () => {
    const memberIds = selectedUsers.map((u) => u.id);
    await onCreateGroupChat(groupName, memberIds);

    setIsOpen(false);
    setGroupName("");
    setGroupUserSearchTerm("");
    setSelectedUsers([]);
  };

  const handleAddUser = (user: User) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2 h-10 rounded-md text-sm font-medium cursor-pointer">
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-[#0d0f12] border border-gray-800 text-white max-w-md rounded-2xl shadow-2xl p-0">
        <DialogHeader className="border-b border-gray-800 p-4 pb-3">
          <DialogTitle className="text-lg font-semibold">Start a Conversation</DialogTitle>
        </DialogHeader>

        <div className="p-4 pt-3">
          <Tabs defaultValue="direct" className="w-full">
            <TabsList className="grid grid-cols-2 bg-gray-800/50 rounded-lg p-1 h-10">
              <TabsTrigger
                value="direct"
                className="data-[state=active]:bg-gray-700 data-[state=active]:text-white rounded-md text-sm"
              >
                Direct Message
              </TabsTrigger>
              <TabsTrigger
                value="group"
                className="data-[state=active]:bg-gray-700 data-[state=active]:text-white rounded-md text-sm"
              >
                Group Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="direct" className="mt-4 space-y-4">
              <DirectChatTab
                searchTerm={userSearchTerm}
                onSearchChange={setUserSearchTerm}
                onSelectUser={handleCreateDirectChat}
                isCreating={isCreatingDirect}
              />
            </TabsContent>

            <TabsContent value="group" className="mt-4 space-y-4">
              <GroupChatTab
                groupName={groupName}
                onGroupNameChange={setGroupName}
                searchTerm={groupUserSearchTerm}
                onSearchChange={setGroupUserSearchTerm}
                selectedUsers={selectedUsers}
                onAddUser={handleAddUser}
                onRemoveUser={handleRemoveUser}
                onCreateGroup={handleCreateGroup}
                isCreating={isCreatingGroup}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
