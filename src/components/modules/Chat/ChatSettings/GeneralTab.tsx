import { useState } from "react";
import { Button } from "@components/ui/button";
import { toast } from "react-hot-toast";
import { useUpdateConversationName, useUpdateGroupImage } from "@/api/conversations";
import { getServerError } from "@/lib/https";

interface GeneralTabProps {
  conversationId: string;
  conversationName: string;
  isGroup: boolean;
  groupImage?: string | null;
  hasLeft?: boolean;
  canRename?: boolean;
  canChangeImage?: boolean;
}

export function GeneralTab({
  conversationId,
  conversationName,
  isGroup,
  groupImage,
  hasLeft,
  canRename = true,
  canChangeImage = true,
}: GeneralTabProps) {
  const [newName, setNewName] = useState(conversationName);
  
  const { mutateAsync: updateName, isPending: isSaving } = useUpdateConversationName();
  const { mutateAsync: updateImage, isPending: uploading } = useUpdateGroupImage();

  const handleRename = async () => {
    if (!newName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    try {
      await updateName({ conversationId, name: newName });
      toast.success("Name updated!");
    } catch (err: any) {
      const errMsg = getServerError(err);
      toast.error(errMsg);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await updateImage({ conversationId, file });
      toast.success("Group image updated!");
    } catch (err: any) {
      const errMsg = getServerError(err);
      toast.error(errMsg);
    } finally {
      e.currentTarget.value = "";
    }
  };

  return (
    <div className="mt-4 space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">
          {isGroup ? "Group Name" : "Name"}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter name..."
            className="bg-gray-800/60 border-gray-700 text-white rounded-lg h-11 flex-1 px-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all"
            aria-label="Conversation name"
            disabled={isSaving || hasLeft || !canRename}
          />

        {!hasLeft && canRename && (
          <Button
            onClick={handleRename}
            isLoading={isSaving}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save
          </Button>
        )}
        </div>
        {!canRename && !hasLeft && (
          <p className="text-xs text-red-400">Only admins can rename this group</p>
        )}
      </div>

      {isGroup && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">
            Group Image
          </label>
          <div className="flex items-center gap-4">
            {groupImage && (
              <div className="relative w-16 h-16 rounded-full overflow-hidden border border-gray-700">
                <img
                  src={groupImage}
                  alt="Group"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {!hasLeft && canChangeImage ? (
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors text-sm font-medium text-gray-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{uploading ? "Uploading..." : "Upload Image"}</span>
                </div>
              </label>
            ) : !hasLeft && (
              <p className="text-xs text-red-400">Only admins can change the group image</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
