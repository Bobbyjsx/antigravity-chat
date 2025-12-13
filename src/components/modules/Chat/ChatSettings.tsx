"use client";

import { useState, useMemo } from "react";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import {
  useConversation,
  useConversationMembers,
} from "@/api/conversations";
import { useViewer } from "@/api/users";
import { cn } from "@/lib/utils";

import { GeneralTab } from "./ChatSettings/GeneralTab";
import { MembersTab } from "./ChatSettings/MembersTab";
import { DangerTab } from "./ChatSettings/DangerTab";
import { PermissionsTab } from "./ChatSettings/PermissionsTab";

interface ChatSettingsProps {
  conversationId: string;
  conversationName?: string;
  isGroup: boolean;
  groupImage?: string | null;
  hasLeft?: boolean;
}

export function ChatSettings({
  conversationId,
  conversationName = "",
  isGroup,
  groupImage,
  hasLeft = false,
}: ChatSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(isGroup ? "general" : "danger");

  const { data: viewer } = useViewer();
  const { data: conversation } = useConversation(conversationId);
  const { data: members, isLoading: loadingMembers } = useConversationMembers(
    conversationId,
    isOpen && isGroup
  );

  // Determine current user role and admin status
  const currentUserRole = useMemo(() => {
    if (!members || !viewer) return undefined;
    return members.find((m) => m.user_id === viewer.id)?.role;
  }, [members, viewer]);

  const isAdmin = useMemo(
    () => currentUserRole === "admin" || currentUserRole === "super_admin",
    [currentUserRole]
  );

  // Tab permissions
  const canRename = isAdmin || !conversation?.only_admins_can_rename;
  const canChangeImage =
    isAdmin || !conversation?.only_admins_can_change_image;
  const canAddMembers =
    isAdmin || !conversation?.only_admins_can_add_members;

  // Tabs config to avoid repetition
  const tabsConfig = useMemo(() => {
    const baseTabs = [];

    if (isGroup) {
      baseTabs.push(
        {
          value: "general",
          label: "General",
          component: (
            <>
              {hasLeft && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200 text-sm">
                  You have left this group. Settings are read-only.
                </div>
              )}
              <GeneralTab
                conversationId={conversationId}
                conversationName={conversationName}
                hasLeft={hasLeft}
                isGroup={isGroup}
                groupImage={groupImage}
                canRename={canRename}
                canChangeImage={canChangeImage}
              />
            </>
          ),
        },
        {
          value: "members",
          label: "Members",
          disabled: !isGroup,
          component: (
            <MembersTab
              conversationId={conversationId}
              members={members as any}
              isLoading={loadingMembers}
              currentUserId={viewer?.id}
              currentUserRole={currentUserRole}
              canAddMembers={canAddMembers && !hasLeft}
            />
          ),
        },
        {
          value: "permissions",
          label: "Permissions",
          disabled: !isGroup,
          component: (
            <PermissionsTab
              conversationId={conversationId}
              settings={{
                only_admins_can_rename: conversation?.only_admins_can_rename,
                only_admins_can_add_members:
                  conversation?.only_admins_can_add_members,
                only_admins_can_change_image:
                  conversation?.only_admins_can_change_image,
              }}
              isAdmin={!!isAdmin && !hasLeft}
            />
          ),
        }
      );
    }

    baseTabs.push({
      value: "danger",
      label: "Danger",
      component: hasLeft ? (
        <div className="mt-4 text-center text-gray-400 text-sm">
          You have already left this group.
        </div>
      ) : (
        <DangerTab
          conversationId={conversationId}
          isGroup={isGroup}
          currentUserRole={currentUserRole}
          onClose={() => setIsOpen(false)}
        />
      ),
    });

    return baseTabs;
  }, [
    isGroup,
    hasLeft,
    conversationId,
    conversationName,
    groupImage,
    members,
    loadingMembers,
    viewer?.id,
    currentUserRole,
    isAdmin,
    canRename,
    canChangeImage,
    canAddMembers,
    conversation?.only_admins_can_rename,
    conversation?.only_admins_can_add_members,
    conversation?.only_admins_can_change_image,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          aria-label="Chat settings"
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
        >
          <Settings className="w-5 h-5 text-gray-300" />
        </button>
      </DialogTrigger>

      <DialogContent className="bg-[#0b0d10] border border-gray-800 text-white max-w-lg rounded-2xl shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-gray-800/60">
          <DialogTitle className="text-lg font-semibold">Chat Settings</DialogTitle>
        </DialogHeader>

        <div className="p-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList
              className={cn(
                "grid gap-2 bg-gray-300/30 p-1 px-2 h-14 rounded-lg",
                isGroup ? "grid-cols-4" : "grid-cols-1"
              )}
            >
              {tabsConfig.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  disabled={tab.disabled}
                  className={cn(
                    "rounded-md py-2 text-sm transition-all duration-200 text-gray-400 hover:text-gray-300 hover:bg-gray-800/50",
                    activeTab === tab.value &&
                      (tab.value === "danger"
                        ? "!bg-red-700/30 !text-red-200 shadow-md border border-red-700/40"
                        : "!bg-gray-800 !text-white shadow-md")
                  )
                }
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {tabsConfig.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {tab.component}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
