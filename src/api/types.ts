export type User = {
  id: string;
  email: string;
  name?: string;
  image?: string;
  created_at: string;
};

export type MemberRole = 'super_admin' | 'admin' | 'member'

export type SystemEventType = 
  | 'member_added'
  | 'member_removed'
  | 'member_left'
  | 'admin_promoted'
  | 'admin_demoted'
  | 'name_changed'
  | 'image_changed'
  | 'group_created'
  | 'call_started'
  | 'call_joined'
  | 'call_ended';

export type ConversationMember = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  left_at?: string | null;
  removed_by?: string | null;
  users?: User;
};

export type Conversation = {
  id: string;
  created_at: string;
  name?: string;
  is_group: boolean;
  group_image?: string;
  last_message_id?: string;
  last_message_time?: string;
  last_message?: Message;
  user?: User;
  left_at?: string | null;
  only_admins_can_rename?: boolean;
  only_admins_can_add_members?: boolean;
  only_admins_can_change_image?: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id?: string | null;
  content: string;
  type: "text" | "image" | "video" | "file";
  is_system: boolean;
  system_event_type?: SystemEventType | null;
  system_event_data?: Record<string, any> | null;
  created_at: string;
  delivered_at?: string | null;
  seen_at?: string | null;
  _isOptimistic?: boolean; // For optimistic updates
};

export type ConversationWithUser = Conversation & {
  other_user?: User;
};
