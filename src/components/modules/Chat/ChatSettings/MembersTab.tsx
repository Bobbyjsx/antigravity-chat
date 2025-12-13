import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar";
import { MoreVertical, Shield, ShieldAlert, UserMinus, Loader2, UserPlus, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import type { ConversationMember, MemberRole } from "@/api/types";
import { 
  useAddMembers, 
  usePromoteToAdmin, 
  useDemoteFromAdmin, 
  useRemoveMember 
} from "@/api/conversations";
import { useSearchUsers } from "@/api/users";
import { toast } from "react-hot-toast";
import { getServerError } from "@/lib/https";

interface MembersTabProps {
  conversationId: string;
  members?: ConversationMember[];
  isLoading: boolean;
  currentUserId?: string;
  currentUserRole?: MemberRole;
  canAddMembers?: boolean;
}

export function MembersTab({ 
  conversationId,
  members, 
  isLoading, 
  currentUserId, 
  currentUserRole,
  canAddMembers = true
}: MembersTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const { data: searchResults, isLoading: isSearching } = useSearchUsers(searchTerm);
  const { mutateAsync: addMembers, isPending: isAdding } = useAddMembers();
  
  const { mutateAsync: promoteToAdmin } = usePromoteToAdmin();
  const { mutateAsync: demoteFromAdmin } = useDemoteFromAdmin();
  const { mutateAsync: removeMember } = useRemoveMember();

  const handlePromote = async (userId: string) => {
    setProcessingId(userId);
    try {
      await promoteToAdmin({ conversationId, userId });
      toast.success("Member promoted to admin");
    } catch (err: any) {
      toast.error(getServerError(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDemote = async (userId: string) => {
    setProcessingId(userId);
    try {
      await demoteFromAdmin({ conversationId, userId });
      toast.success("Admin demoted to member");
    } catch (err: any) {
      toast.error(getServerError(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    setProcessingId(userId);
    try {
      await removeMember({ conversationId, userId });
      toast.success("Member removed from group");
    } catch (err: any) {
      toast.error(getServerError(err));
    } finally {
      setProcessingId(null);
    }
  };

  const canManage = (targetMember: ConversationMember) => {
    if (!currentUserRole || !currentUserId) return false;
    if (targetMember.user_id === currentUserId) return false; // Can't manage self here
    
    if (currentUserRole === 'super_admin') return true;
    if (currentUserRole === 'admin' && targetMember.role === 'member') return true;
    
    return false;
  };

  const getRoleBadge = (role: MemberRole) => {
    switch (role) {
      case 'super_admin':
        return <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">Owner</span>;
      case 'admin':
        return <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">Admin</span>;
      default:
        return null;
    }
  };

  const handleAddMembers = async () => {
    if (selectedUserIds.size === 0) return;

    try {
      await addMembers({ conversationId, memberIds: Array.from(selectedUserIds) });
      toast.success("Members added successfully");
      setIsAddDialogOpen(false);
      setSelectedUserIds(new Set());
      setSearchTerm("");
    } catch (err: any) {
      toast.error(getServerError(err));
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const existingMemberIds = new Set(members?.map(m => m.user_id));

  return (
    <div className="mt-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-300">
            Members ({members?.length || 0})
          </label>
          
          {canAddMembers && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 gap-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300">
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#1a1d21] border-gray-700 text-white sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Members</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input
                    placeholder="Search users by email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  
                  <div className="h-60 overflow-y-auto space-y-2 pr-2">
                    {isSearching ? (
                      <div className="flex justify-center py-4 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : searchTerm && searchResults?.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">
                        No users found
                      </div>
                    ) : (
                      searchResults?.map(user => {
                        const isMember = existingMemberIds.has(user.id);
                        const isSelected = selectedUserIds.has(user.id);
                        
                        return (
                          <div 
                            key={user.id} 
                            className={`flex items-center justify-between p-2 rounded-lg border ${
                              isMember 
                                ? "bg-gray-800/20 border-transparent opacity-50" 
                                : isSelected
                                  ? "bg-blue-500/20 border-blue-500/50"
                                  : "bg-gray-800/40 border-gray-700/30 hover:bg-gray-800/60"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.image} />
                                <AvatarFallback>{user.name?.[0] || user.email[0]}</AvatarFallback>
                              </Avatar>
                              <div className="overflow-hidden">
                                <p className="text-sm font-medium text-white truncate">{user.name || "Unknown"}</p>
                                <p className="text-xs text-gray-400 truncate">{user.email}</p>
                              </div>
                            </div>
                            
                            {isMember ? (
                              <span className="text-xs text-gray-500 px-2">Joined</span>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-7 w-7 rounded-full ${isSelected ? "bg-blue-500 text-white hover:bg-blue-600" : "hover:bg-gray-700"}`}
                                onClick={() => toggleUserSelection(user.id)}
                              >
                                {isSelected ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)} disabled={isAdding}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddMembers} 
                      disabled={selectedUserIds.size === 0 || isAdding}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isAdding ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        `Add ${selectedUserIds.size} Member${selectedUserIds.size !== 1 ? 's' : ''}`
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-400">Loading members...</div>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
            {members?.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/30 group hover:bg-gray-800/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.users?.image} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                      {member.users?.name?.[0] ||
                        member.users?.email?.[0]?.toUpperCase() ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">
                        {member.users?.name || "Unknown User"}
                      </p>
                      {getRoleBadge(member.role)}
                    </div>
                    <p className="text-xs text-gray-400">{member.users?.email}</p>
                  </div>
                </div>

                {canManage(member) && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" disabled={!!processingId}>
                        {processingId === member.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreVertical className="h-4 w-4" />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto bg-[#1a1d21] border-gray-700 p-1" align="end">
                      <div className="space-y-1">
                        {member.role === 'member' && (
                          <button
                            onClick={() => handlePromote(member.user_id)}
                            disabled={!!processingId}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Shield className="h-4 w-4 text-blue-400" />
                            Make Admin
                          </button>
                        )}
                        
                        {member.role === 'admin' && currentUserRole === 'super_admin' && (
                          <button
                            onClick={() => handleDemote(member.user_id)}
                            disabled={!!processingId}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-800 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ShieldAlert className="h-4 w-4 text-orange-400" />
                            Remove Admin
                          </button>
                        )}

                        <button
                          onClick={() => handleRemove(member.user_id)}
                          disabled={!!processingId}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:bg-red-900/20 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <UserMinus className="h-4 w-4" />
                          Remove from Group
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
