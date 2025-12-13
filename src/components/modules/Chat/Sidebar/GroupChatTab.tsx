import { useSearchUsers, type User } from "@/api/users";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";

interface GroupChatTabProps {
  groupName: string;
  onGroupNameChange: (value: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedUsers: User[];
  onAddUser: (user: User) => void;
  onRemoveUser: (userId: string) => void;
  onCreateGroup: () => void;
  isCreating?: boolean;
}

export function GroupChatTab({
  groupName,
  onGroupNameChange,
  searchTerm,
  onSearchChange,
  selectedUsers,
  onAddUser,
  onRemoveUser,
  onCreateGroup,
  isCreating = false,
}: GroupChatTabProps) {
  const { data: searchResults, isLoading } = useSearchUsers(searchTerm);

  return (
    <>
      <Input
        placeholder="Group name..."
        value={groupName}
        onChange={(e) => onGroupNameChange(e.target.value)}
        className="bg-gray-800 border-gray-700 text-white"
      />

      <Input
        placeholder="Search users to add..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-gray-800 border-gray-700 text-white"
      />

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 bg-gray-700 rounded-full px-3 py-1"
            >
              <span className="text-sm text-white">{user.name || user.email}</span>
              <button
                onClick={() => onRemoveUser(user.id)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-h-48 overflow-y-auto space-y-2">
        {isLoading && <p className="text-center text-gray-400">Searching...</p>}
        {!isLoading && searchTerm && searchResults?.length === 0 && (
          <p className="text-center text-gray-400">No users found</p>
        )}
        {searchResults
          ?.filter((user) => !selectedUsers.find((u) => u.id === user.id))
          .map((user: User) => (
            <button
              key={user.id}
              onClick={() => onAddUser(user)}
              className="w-full p-3 flex items-center gap-3 hover:bg-gray-700 rounded-lg transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {user.name?.[0] || "U"}
              </div>
              <div>
                <p className="font-medium text-white">{user.name || "Unknown User"}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </button>
          ))}
      </div>

      <Button
        onClick={onCreateGroup}
        disabled={!groupName.trim() || selectedUsers.length < 1}
        isLoading={isCreating}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        Create Group ({selectedUsers.length + 1} members)
      </Button>
    </>
  );
}
