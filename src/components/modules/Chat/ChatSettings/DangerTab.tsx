import { useState } from "react";
import { Trash2, LogOut, AlertTriangle } from "lucide-react";
import { Button } from "@components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@components/ui/popover";
import type { MemberRole } from "@/api/types";
import { useDeleteConversation, useLeaveConversation } from "@/api/conversations";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { getServerError } from "@/lib/https";

interface DangerTabProps {
  conversationId: string;
  isGroup: boolean;
  currentUserRole?: MemberRole;
  onClose?: () => void;
}

export function DangerTab({
  conversationId,
  isGroup,
  currentUserRole,
  onClose,
}: DangerTabProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionType, setActionType] = useState<'leave' | 'delete' | null>(null);

  const router = useRouter();
  const { mutateAsync: deleteConv, isPending: isDeleting } = useDeleteConversation();
  const { mutateAsync: leaveConv, isPending: isLeaving } = useLeaveConversation();

  const handleDeleteConversation = async () => {
    try {
      await deleteConv(conversationId);
      toast.success("Conversation deleted");
      onClose?.();
      router.push("/chat");
    } catch (err: any) {
      const errMsg = getServerError(err);
      toast.error(errMsg);
    } finally {
      setConfirmingDelete(false);
    }
  };

  const handleLeaveConversation = async (removeAllMembers: boolean = false) => {
    try {
      if (removeAllMembers) setActionType('delete');
      else setActionType('leave');

      await leaveConv({ conversationId, removeAllMembers });
      toast.success(removeAllMembers ? "Group deleted" : "Left group");
      onClose?.();
      router.push("/chat");
    } catch (err: any) {
      const errMsg = getServerError(err);
      toast.error(errMsg);
    } finally {
      setActionType(null);
    }
  };

  const handleLeave = (type: 'leave' | 'delete') => {
    handleLeaveConversation(type === 'delete');
  };
  
  // Direct Chat: Simple Delete
  if (!isGroup) {
    return (
      <div className="mt-4">
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Deleting this conversation is permanent and cannot be undone.
          </p>

          <div className="flex">
            <Button
              onClick={confirmingDelete ? handleDeleteConversation : () => setConfirmingDelete(true)}
              isLoading={isDeleting}
              className="flex-1 h-11 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium"
            >
              {confirmingDelete ? (
                "Confirm Delete"
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Conversation
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Group Chat: Super Admin
  if (currentUserRole === 'super_admin') {
    return (
      <div className="mt-4">
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            As the owner, you can delete this group for everyone or just leave it yourself.
          </p>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="w-full h-11 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium"
                isLoading={isDeleting || isLeaving}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete / Leave Group
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-[#1a1d21] border-gray-700 p-3" align="center">
              <div className="space-y-3">
                <div className="space-y-1">
                  <h4 className="font-medium text-white">Delete Group?</h4>
                  <p className="text-xs text-gray-400">Choose how you want to remove this group.</p>
                </div>
                
                <div className="space-y-2">
                  <Button 
                    variant="destructive" 
                    className="w-full justify-start"
                    onClick={() => handleLeave('leave')}
                    isLoading={isLeaving && actionType === 'leave'}
                    disabled={isLeaving}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Just Leave (Keep for others)
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    className="w-full justify-start bg-red-900/50 hover:bg-red-900"
                    onClick={() => handleLeave('delete')}
                    isLoading={isLeaving && actionType === 'delete'}
                    disabled={isLeaving}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Delete for Everyone
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  }

  // Group Chat: Regular Member / Admin
  return (
    <div className="mt-4">
      <div className="space-y-3">
        <p className="text-sm text-gray-400">
          Leaving this group will remove it from your list. You can be re-added later.
        </p>

        <div className="flex">
          <Button
            onClick={() => handleLeaveConversation(false)}
            isLoading={isLeaving}
            className="flex-1 h-11 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave Group
          </Button>
        </div>
      </div>
    </div>
  );
}
