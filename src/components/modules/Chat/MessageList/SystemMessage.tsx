import { Shield, ShieldAlert, UserMinus, UserPlus, LogOut, Edit2, Image as ImageIcon, Users } from "lucide-react";
import type { Message } from "@/api/types";

interface SystemMessageProps {
  message: Message;
}

export function SystemMessage({ message }: SystemMessageProps) {
  if (!message.is_system || !message.system_event_type) return null;

  const getIcon = () => {
    switch (message.system_event_type) {
      case 'member_added':
        return <UserPlus className="w-3 h-3" />;
      case 'member_removed':
        return <UserMinus className="w-3 h-3" />;
      case 'member_left':
        return <LogOut className="w-3 h-3" />;
      case 'admin_promoted':
        return <Shield className="w-3 h-3" />;
      case 'admin_demoted':
        return <ShieldAlert className="w-3 h-3" />;
      case 'name_changed':
        return <Edit2 className="w-3 h-3" />;
      case 'image_changed':
        return <ImageIcon className="w-3 h-3" />;
      case 'group_created':
        return <Users className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center w-full my-2">
      <div className="flex items-center gap-2 px-3 py-1">
        <span className="text-gray-500/70">{getIcon()}</span>
        <span className="text-xs text-gray-500/70 font-medium">{message.content}</span>
      </div>
    </div>
  );
}
