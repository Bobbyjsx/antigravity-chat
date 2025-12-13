import { createClient } from "@/lib/supabase/client";
import { Conversation, ConversationWithUser } from "./types";

export const listConversations = async (): Promise<ConversationWithUser[]> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // Get conversations where user is a member (including left ones)
  const { data: memberData, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id, left_at')
    .eq('user_id', user.id);

  if (memberError) throw memberError;
  if (!memberData || memberData.length === 0) return [];

  const conversationIds = memberData.map(m => m.conversation_id);
  const leftAtMap = new Map(memberData.map(m => [m.conversation_id, m.left_at]));

  // Get conversation details
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .in('id', conversationIds)
    .order('updated_at', { ascending: false });

  if (convError) throw convError;
  if (!conversations) return [];

  // For each conversation, get the other user (for 1-on-1 chats)
  const result: ConversationWithUser[] = await Promise.all(
    conversations.map(async (conv) => {
      let lastMessage = null;
      if (conv.last_message_id) {
        const { data: message } = await supabase
          .from('messages')
          .select('*')
          .eq('id', conv.last_message_id)
          .single();
        lastMessage = message;
      }

      const leftAt = leftAtMap.get(conv.id);

      if (conv.is_group) {
        return {
          ...conv,
          is_group: true,
          other_user: null,
          last_message: lastMessage,
          last_message_time: conv.updated_at,
          left_at: leftAt,
        };
      }

      // For 1-on-1, get the other user
      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conv.id)
        .neq('user_id', user.id)
        .single();

      if (!members) {
        return {
          ...conv,
          is_group: false,
          other_user: null,
          last_message: lastMessage,
          last_message_time: conv.updated_at,
          left_at: leftAt,
        };
      }

      const { data: otherUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', members.user_id)
        .single();

      return {
        ...conv,
        is_group: false,
        other_user: otherUser || null,
        last_message: lastMessage,
        last_message_time: conv.updated_at,
        left_at: leftAt,
      };
    })
  );
  return result;
};

// Create a new 1-on-1 conversation
export async function createConversation(otherUserId: string): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  // First, check if a conversation already exists between these two users
  const { data: existingConversations } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations!inner(is_group)')
    .eq('user_id', user.id);

  if (existingConversations) {
    // Check each conversation to see if it's a 1-on-1 with the target user
    for (const conv of existingConversations) {
      // Skip group conversations
      //@ts-ignore
      if (conv.conversations?.is_group) continue;

      // Check if the other user is in this conversation
      const { data: otherMember } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conv.conversation_id)
        .eq('user_id', otherUserId)
        .single();

      // If found, return the existing conversation
      if (otherMember) {
        return conv.conversation_id;
      }
    }
  }

  // No existing conversation found, create a new one
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({ is_group: false })
    .select()
    .single();

  if (convError) throw convError;

  // Add both users as members
  const { error: membersError } = await supabase
    .from('conversation_members')
    .insert([
      { conversation_id: conversation.id, user_id: user.id },
      { conversation_id: conversation.id, user_id: otherUserId },
    ]);

  if (membersError) throw membersError;

  return conversation.id;
}

export const createGroupConversation = async (name: string, memberIds: string[]): Promise<string> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");
  if (memberIds.length < 1) throw new Error("Group must have at least 1 other member");

  // 1. Create conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({ is_group: true, name })
    .select()
    .single();

  if (convError) throw convError;

  // 2. Add members with roles
  // Creator is super_admin, others are members
  const uniqueMemberIds = Array.from(new Set([user.id, ...memberIds]));

  const members = uniqueMemberIds.map(userId => ({
    conversation_id: conversation.id,
    user_id: userId,
    role: userId === user.id ? 'super_admin' : 'member'
  }));

  const { error: membersError } = await supabase
    .from('conversation_members')
    .insert(members);

  if (membersError) throw membersError;

  // 3. Create system message for group creation
  await createSystemMessage(conversation.id, 'group_created', {
    creatorId: user.id,
    memberCount: uniqueMemberIds.length
  });

  return conversation.id;
};

// Update conversation name
export const updateConversationName = async (conversationId: string, name: string): Promise<void> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");
  if (!name.trim()) throw new Error("Name cannot be empty");

  // Check permissions
  const { data: conversation } = await supabase
    .from('conversations')
    .select('only_admins_can_rename')
    .eq('id', conversationId)
    .single();

  if (conversation?.only_admins_can_rename) {
    const member = await getConversationMember(conversationId, user.id);
    if (!member || !['admin', 'super_admin'].includes(member.role)) {
      throw new Error("Only admins can rename this group");
    }
  }

  const { error } = await supabase
    .from("conversations")
    .update({ name: name.trim() })
    .eq("id", conversationId);

  if (error) throw error;

  // Create system message for name change
  await createSystemMessage(conversationId, 'name_changed', {
    newName: name.trim(),
    changedBy: user.id
  });
};

// Update group image
export const updateGroupImage = async (conversationId: string, file: File): Promise<string> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Check permissions
  const { data: conversation } = await supabase
    .from('conversations')
    .select('only_admins_can_change_image')
    .eq('id', conversationId)
    .single();

  if (conversation?.only_admins_can_change_image) {
    const member = await getConversationMember(conversationId, user.id);
    if (!member || !['admin', 'super_admin'].includes(member.role)) {
      throw new Error("Only admins can change the group image");
    }
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `${conversationId}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("group-images")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("group-images").getPublicUrl(fileName);
  const publicUrl = data.publicUrl;

  const { error: updateError } = await supabase
    .from("conversations")
    .update({ group_image: publicUrl })
    .eq("id", conversationId);

  if (updateError) throw updateError;

  // Create system message for image change
  await createSystemMessage(conversationId, 'image_changed', {
    changedBy: user.id
  });

  return publicUrl;
};

// Delete conversation
export const deleteConversation = async (conversationId: string): Promise<void> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (error) throw error;
};

// Get single conversation by ID
export const getConversation = async (conversationId: string): Promise<Conversation> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) throw error;

  // Get current user's membership to check if they left
  const { data: currentMember } = await supabase
    .from('conversation_members')
    .select('left_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single();

  if (conversation.is_group) {
    return {
      ...conversation,
      user: null,
      left_at: currentMember?.left_at,
    };
  }

  // For 1-on-1, get the other user
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversation.id)
    .neq('user_id', user.id)
    .single();

  if (!members) {
    return {
      ...conversation,
      user: null,
      left_at: currentMember?.left_at,
    };
  }

  const { data: otherUser } = await getUserById(members.user_id);

  return {
    ...conversation,
    user: otherUser || null,
    left_at: currentMember?.left_at,
  };
};

// Get conversation members
export const getConversationMembers = async (conversationId: string) => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("conversation_members")
    .select(`
      id,
      conversation_id,
      user_id,
      role,
      joined_at,
      left_at,
      removed_by,
      users:users!conversation_members_user_id_fkey (
        id,
        name,
        email
      )
    `)
    .eq("conversation_id", conversationId)
    .is('left_at', null);

  if (error) throw error;
  return data;
};


// ===== Member Management Functions =====

// Get member with role info
export const getConversationMember = async (
  conversationId: string, 
  userId: string
): Promise<import('./types').ConversationMember | null> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .is('left_at', null)
    .single();
  
  if (error) return null;
  return data as import('./types').ConversationMember;
};

// Helper to generate system message content
function generateSystemMessageContent(
  eventType: import('./types').SystemEventType,
  data: Record<string, any>
): string {
  switch (eventType) {
    case 'member_added':
      return `${data.userName || 'A user'} was added to the group`;
    case 'member_removed':
      return data.userId === 'all' 
        ? 'All members were removed from the group'
        : `${data.userName || 'A user'} was removed from the group`;
    case 'member_left':
      return `${data.userName || 'A user'} left the group`;
    case 'admin_promoted':
      return `${data.userName || 'A user'} is now an admin`;
    case 'admin_demoted':
      return `${data.userName || 'A user'} is no longer an admin`;
    case 'name_changed':
      return `Group name changed to "${data.newName}"`;
    case 'image_changed':
      return 'Group image was updated';
    case 'group_created':
      return 'Group created';
    default:
      return 'Group updated';
  }
}

// Create system message helper
export const createSystemMessage = async (
  conversationId: string,
  eventType: import('./types').SystemEventType,
  eventData: Record<string, any>
): Promise<void> => {
  const supabase = createClient();
  
  // Generate human-readable content
  const content = generateSystemMessageContent(eventType, eventData);

  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      content,
      is_system: true,
      system_event_type: eventType,
      system_event_data: eventData,
      type: 'text'
    });

  if (error) throw error;
};

// Promote user to admin
export const promoteToAdmin = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  const supabase = createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) throw new Error('Not authenticated');

  // Check if current user is admin
  const currentMember = await getConversationMember(conversationId, currentUser.id);
  if (!currentMember || !['admin', 'super_admin'].includes(currentMember.role)) {
    throw new Error('Only admins can promote members');
  }

  // Get target member to get their name
  const { data: targetUser } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .single();

  const { error } = await supabase
    .from('conversation_members')
    .update({ role: 'admin' })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .is('left_at', null);

  if (error) throw error;

  // Create system message
  await createSystemMessage(conversationId, 'admin_promoted', { 
    userId,
    userName: targetUser?.name || targetUser?.email || 'Unknown user'
  });
};

// Demote admin to member
export const demoteFromAdmin = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  const supabase = createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) throw new Error('Not authenticated');

  // Check permissions
  const currentMember = await getConversationMember(conversationId, currentUser.id);
  const targetMember = await getConversationMember(conversationId, userId);

  if (!currentMember || currentMember.role !== 'super_admin') {
    throw new Error('Only super admins can demote admins');
  }

  if (targetMember?.role === 'super_admin') {
    throw new Error('Cannot demote super admin');
  }

  // Get target user name
  const { data: targetUser } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .single();

  const { error } = await supabase
    .from('conversation_members')
    .update({ role: 'member' })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .is('left_at', null);

  if (error) throw error;

  await createSystemMessage(conversationId, 'admin_demoted', { 
    userId,
    userName: targetUser?.name || targetUser?.email || 'Unknown user'
  });
};

// Remove member from group
export const removeMember = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  const supabase = createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) throw new Error('Not authenticated');

  // Check permissions
  const currentMember = await getConversationMember(conversationId, currentUser.id);
  const targetMember = await getConversationMember(conversationId, userId);

  if (!currentMember || !['admin', 'super_admin'].includes(currentMember.role)) {
    throw new Error('Only admins can remove members');
  }

  if (targetMember?.role === 'super_admin') {
    throw new Error('Cannot remove super admin');
  }

  // Get target user name
  const { data: targetUser } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .single();

  // Mark as left with removed_by
  const { error } = await supabase
    .from('conversation_members')
    .update({ 
      left_at: new Date().toISOString(),
      removed_by: currentUser.id
    })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .is('left_at', null);

  if (error) throw error;

  await createSystemMessage(conversationId, 'member_removed', { 
    userId, 
    removedBy: currentUser.id,
    userName: targetUser?.name || targetUser?.email || 'Unknown user'
  });
};

// Leave conversation
export const leaveConversation = async (
  conversationId: string,
  removeAllMembers: boolean = false
): Promise<void> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const member = await getConversationMember(conversationId, user.id);
  
  // Get current user name
  const { data: currentUserData } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', user.id)
    .single();
  
  if (member?.role === 'super_admin' && removeAllMembers) {
    // Super admin removing everyone
    // Send system message FIRST while still a member
    await createSystemMessage(conversationId, 'member_removed', { 
      userId: 'all',
      removedBy: user.id,
      userName: 'All members'
    });

    const { error } = await supabase
      .from('conversation_members')
      .update({ 
        left_at: new Date().toISOString(),
        removed_by: user.id
      })
      .eq('conversation_id', conversationId)
      .is('left_at', null);

    if (error) throw error;

  } else {
    // Regular leave
    // Send system message FIRST while still a member
    await createSystemMessage(conversationId, 'member_left', { 
      userId: user.id,
      userName: currentUserData?.name || currentUserData?.email || 'Unknown user'
    });

    const { error } = await supabase
      .from('conversation_members')
      .update({ left_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .is('left_at', null);

    if (error) throw error;
  }
};

// Add members to existing conversation
export const addMembers = async (
  conversationId: string,
  memberIds: string[]
): Promise<void> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (memberIds.length === 0) return;

  // Check permissions
  const { data: conversation } = await supabase
    .from('conversations')
    .select('only_admins_can_add_members')
    .eq('id', conversationId)
    .single();

  if (conversation?.only_admins_can_add_members) {
    const member = await getConversationMember(conversationId, user.id);
    if (!member || !['admin', 'super_admin'].includes(member.role)) {
      throw new Error("Only admins can add members to this group");
    }
  }

  // Filter out existing members
  const { data: existingMembers } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .in('user_id', memberIds)
    .is('left_at', null);

  const existingMemberIds = new Set(existingMembers?.map(m => m.user_id) || []);
  const newMemberIds = memberIds.filter(id => !existingMemberIds.has(id));

  if (newMemberIds.length === 0) return;

  const newMembers = newMemberIds.map(userId => ({
    conversation_id: conversationId,
    user_id: userId,
    role: 'member' as const
  }));

  const { error } = await supabase
    .from('conversation_members')
    .insert(newMembers);

  if (error) throw error;

  // Create system message
  // We'll create one message per added user for clarity, or one bulk message
  // Let's do individual for now as per system message helper design, or update helper
  // For simplicity, let's just say "X users added" or loop
  
  for (const userId of newMemberIds) {
    const { data: addedUser } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single();

    await createSystemMessage(conversationId, 'member_added', {
      userId,
      addedBy: user.id,
      userName: addedUser?.name || addedUser?.email || 'Unknown user'
    });
  }
};

// Update conversation settings
export const updateConversationSettings = async (
  conversationId: string,
  settings: {
    only_admins_can_rename?: boolean;
    only_admins_can_add_members?: boolean;
    only_admins_can_change_image?: boolean;
  }
): Promise<void> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Only admins can change settings
  const member = await getConversationMember(conversationId, user.id);
  if (!member || !['admin', 'super_admin'].includes(member.role)) {
    throw new Error("Only admins can change group settings");
  }

  const { error } = await supabase
    .from('conversations')
    .update(settings)
    .eq('id', conversationId);

  if (error) throw error;
};






import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "./queryKeys";
import { getUserById } from "./users";

export const useConversations = () => {
  return useQuery({
    queryKey: QUERY_KEYS.conversations,
    queryFn: listConversations,
  });
};

export const useConversation = (conversationId: string) => {
  return useQuery<Conversation>({
    queryKey: QUERY_KEYS.conversation(conversationId),
    queryFn: () => getConversation(conversationId),
  });
};

export const useConversationMembers = (conversationId: string, enabled = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.conversationMembers(conversationId),
    queryFn: () => getConversationMembers(conversationId),
    enabled,
  });
};

export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const useCreateGroupConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, memberIds }: { name: string; memberIds: string[] }) =>
      createGroupConversation(name, memberIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const useUpdateConversationName = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, name }: { conversationId: string; name: string }) =>
      updateConversationName(conversationId, name),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversation(variables.conversationId) });
    },
  });
};

export const useUpdateGroupImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, file }: { conversationId: string; file: File }) =>
      updateGroupImage(conversationId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversation(variables.conversationId) });
    },
  });
};

export const useDeleteConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

// Member management hooks
export const usePromoteToAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      promoteToAdmin(conversationId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationMembers(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(variables.conversationId) });
    },
  });
};

export const useDemoteFromAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      demoteFromAdmin(conversationId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationMembers(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(variables.conversationId) });
    },
  });
};

export const useRemoveMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      removeMember(conversationId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationMembers(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(variables.conversationId) });
    },
  });
};

export const useLeaveConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, removeAll }: { conversationId: string; removeAll?: boolean }) =>
      leaveConversation(conversationId, removeAll),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const useAddMembers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, memberIds }: { conversationId: string; memberIds: string[] }) =>
      addMembers(conversationId, memberIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationMembers(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(variables.conversationId) });
    },
  });
};

export const useUpdateConversationSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ 
      conversationId, 
      settings 
    }: { 
      conversationId: string; 
      settings: {
        only_admins_can_rename?: boolean;
        only_admins_can_add_members?: boolean;
        only_admins_can_change_image?: boolean;
      } 
    }) =>
      updateConversationSettings(conversationId, settings),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversation(variables.conversationId) });
    },
  });
};

