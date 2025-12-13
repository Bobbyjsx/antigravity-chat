import { useSearchUsers, type User } from "@/api/users";
import { Input } from "@components/ui/input";

interface DirectChatTabProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSelectUser: (userId: string) => void;
  isCreating?: boolean;
}

export function DirectChatTab({ searchTerm, onSearchChange, onSelectUser, isCreating = false }: DirectChatTabProps) {
  const { data: searchResults, isLoading } = useSearchUsers(searchTerm);

  return (
    <>
      <Input
        placeholder="Search users..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-gray-800 border-gray-700 text-white"
      />
      <div className="max-h-64 overflow-y-auto space-y-2">
        {isLoading && <p className="text-center text-gray-400">Searching...</p>}
        {!isLoading && searchTerm && searchResults?.length === 0 && (
          <p className="text-center text-gray-400">No users found</p>
        )}
        {searchResults?.map((user: User) => (
          <button
            key={user.id}
            onClick={() => onSelectUser(user.id)}
            disabled={isCreating}
            className="w-full p-3 flex items-center gap-3 hover:bg-gray-700 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {user.name?.[0] || "U"}
            </div>
            <div>
              <p className="font-medium text-white">{user.name || "Unknown User"}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
