import { useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIconClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <Input
        ref={inputRef}
        leftNode={
          <Search 
            className="bg-gray-800 cursor-pointer" 
            onClick={handleIconClick}
          />
        }
        sideNodeClassName="bg-gray-800"
        type="text"
        placeholder="Search chats..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pr-4 py-2 bg-gray-800 border-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
