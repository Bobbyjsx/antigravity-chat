import { LogOut, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover";
import { useViewer } from "@/api/users";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  ItemActions,
} from "@/components/ui/item";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface UserProfileProps {
  onSignOut: () => void;
}

export function UserProfile({ onSignOut }: UserProfileProps) {
  const { data: viewer } = useViewer();

  if (!viewer) return null;

  return (
    <div className="p-4 border-t border-gray-800">
      <Item>
        <ItemMedia>
          <Avatar>
            <AvatarImage src={viewer?.image} />
            <AvatarFallback className="bg-blue-600 text-white">
              {viewer?.name?.[0] || viewer?.email?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-white truncate">{viewer?.name || "User"}</ItemTitle>
          <ItemDescription className="truncate text-gray-400">{viewer?.email}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-slate-800 cursor-pointer">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-gray-800 border-gray-700 text-white mb-2" side="top" align="end">
              <Link
                href="/profile"
                prefetch
                className="w-full p-2 text-left hover:bg-gray-700 rounded transition-colors text-sm"
              >
                View Profile
              </Link>
              <button
                onClick={onSignOut}
                className="w-full p-2 text-left hover:bg-gray-700 rounded transition-colors flex items-center gap-2 text-red-400 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </PopoverContent>
          </Popover>
        </ItemActions>
      </Item>
    </div>
  );
}
