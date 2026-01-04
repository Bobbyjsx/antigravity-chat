'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Conversation, ConversationWithUser, ConversationMember, SystemEventType } from '@/api/types'
import { getUserByIdAction } from './user-actions'

// Helper to get current user and validate
async function getAuthenticatedUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  return user
}

// ----------------------------------------------------------------------
// READ Actions
// ----------------------------------------------------------------------

export async function listConversationsAction(): Promise<ConversationWithUser[]> {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthenticatedUser(supabase)

  // Get conversations where user is a member (including left ones)
  const { data: memberData, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id, left_at')
    .eq('user_id', user.id)

  if (memberError) throw new Error(memberError.message)
  if (!memberData || memberData.length === 0) return []

  const conversationIds = memberData.map((m: any) => m.conversation_id)
  const leftAtMap = new Map(memberData.map((m: any) => [m.conversation_id, m.left_at]))

  // Get conversation details
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .in('id', conversationIds)
    .order('updated_at', { ascending: false })

  if (convError) throw new Error(convError.message)
  if (!conversations) return []

  // For each conversation, get the other user (for 1-on-1 chats)
  const result: ConversationWithUser[] = await Promise.all(
    conversations.map(async (conv: any) => {
      let lastMessage = null
      if (conv.last_message_id) {
        const { data: message } = await supabase
          .from('messages')
          .select('*')
          .eq('id', conv.last_message_id)
          .single()
        lastMessage = message
      }

      const leftAt = leftAtMap.get(conv.id)

      if (conv.is_group) {
        return {
          ...conv,
          is_group: true,
          other_user: null,
          last_message: lastMessage,
          last_message_time: conv.updated_at,
          left_at: leftAt,
        }
      }

      // For 1-on-1, get the other user
      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conv.id)
        .neq('user_id', user.id)
        .maybeSingle()

      if (!members) {
        return {
          ...conv,
          is_group: false,
          other_user: null,
          last_message: lastMessage,
          last_message_time: conv.updated_at,
          left_at: leftAt,
        }
      }

      const { user: otherUser } = await getUserByIdAction(members.user_id)

      return {
        ...conv,
        is_group: false,
        other_user: otherUser || null,
        last_message: lastMessage,
        last_message_time: conv.updated_at,
        left_at: leftAt,
      }
    })
  )
  return result
}

export async function getConversationAction(conversationId: string): Promise<Conversation> {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthenticatedUser(supabase)

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (error) throw new Error(error.message)

  // Get current user's membership to check if they left
  const { data: currentMember } = await supabase
    .from('conversation_members')
    .select('left_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (conversation.is_group) {
    return {
      ...conversation,
      user: null,
      left_at: currentMember?.left_at,
    }
  }

  // For 1-on-1, get the other user
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversation.id)
    .neq('user_id', user.id)
    .single()

  if (!members) {
    return {
      ...conversation,
      user: null,
      left_at: currentMember?.left_at,
    }
  }

  const { user: otherUser } = await getUserByIdAction(members.user_id)

  return {
    ...conversation,
    user: otherUser || null,
    left_at: currentMember?.left_at,
  }
}

export async function getConversationMembersAction(conversationId: string) {
  const supabase = await createSupabaseServerClient()
  await getAuthenticatedUser(supabase)

  const { data, error } = await supabase
    .from('conversation_members')
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
    .eq('conversation_id', conversationId)
    .is('left_at', null)

  if (error) throw new Error(error.message)
  return data
}

export async function getConversationMemberAction(conversationId: string, userId: string): Promise<ConversationMember | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('conversation_members')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .is('left_at', null)
    .single()
  
  if (error) return null
  return data as ConversationMember
}

// ----------------------------------------------------------------------
// WRITE Actions
// ----------------------------------------------------------------------

export async function createConversationAction(otherUserId: string): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthenticatedUser(supabase)

  // First, check if a conversation already exists between these two users
  const { data: existingConversations } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations!inner(is_group)')
    .eq('user_id', user.id)

  if (existingConversations) {
    // Check each conversation to see if it's a 1-on-1 with the target user
    for (const conv of existingConversations) {
      // Skip group conversations
      //@ts-ignore
      if (conv.conversations?.is_group) continue

      // Check if the other user is in this conversation
      const { data: otherMember } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conv.conversation_id)
        .eq('user_id', otherUserId)
        .maybeSingle()

      // If found, return the existing conversation
      if (otherMember) {
        return conv.conversation_id
      }
    }
  }

  // No existing conversation found, create a new one
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({ is_group: false })
    .select()
    .single()

  if (convError) throw new Error(convError.message)

  // Add both users as members
  const { error: membersError } = await supabase
    .from('conversation_members')
    .insert([
      { conversation_id: conversation.id, user_id: user.id },
      { conversation_id: conversation.id, user_id: otherUserId },
    ])

  if (membersError) throw new Error(membersError.message)

  return conversation.id
}

export async function createGroupConversationAction(name: string, memberIds: string[]): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthenticatedUser(supabase)

  if (memberIds.length < 1) throw new Error("Group must have at least 1 other member")

  // 1. Create conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({ is_group: true, name })
    .select()
    .single()

  if (convError) throw new Error(convError.message)

  // 2. Add members with roles
  // Creator is super_admin, others are members
  const uniqueMemberIds = Array.from(new Set([user.id, ...memberIds]))

  const members = uniqueMemberIds.map(userId => ({
    conversation_id: conversation.id,
    user_id: userId,
    role: userId === user.id ? 'super_admin' : 'member'
  }))

  const { error: membersError } = await supabase
    .from('conversation_members')
    .insert(members)

  if (membersError) throw new Error(membersError.message)

  // 3. Create system message for group creation
  await createSystemMessageAction(conversation.id, 'group_created', {
    creatorId: user.id,
    memberCount: uniqueMemberIds.length
  })

  return conversation.id
}

export async function updateConversationNameAction(conversationId: string, name: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthenticatedUser(supabase)

  if (!name.trim()) throw new Error("Name cannot be empty")

  // Check permissions
  const { data: conversation } = await supabase
    .from('conversations')
    .select('only_admins_can_rename')
    .eq('id', conversationId)
    .single()

  if (conversation?.only_admins_can_rename) {
    const member = await getConversationMemberAction(conversationId, user.id)
    if (!member || !['admin', 'super_admin'].includes(member.role)) {
      throw new Error("Only admins can rename this group")
    }
  }

  const { error } = await supabase
    .from("conversations")
    .update({ name: name.trim() })
    .eq("id", conversationId)

  if (error) throw new Error(error.message)

  // Create system message
  await createSystemMessageAction(conversationId, 'name_changed', {
    newName: name.trim(),
    changedBy: user.id
  })
}

// System Message Helper (Private to this module or exported if needed, keeping it here for now)
export async function createSystemMessageAction(
  conversationId: string,
  eventType: SystemEventType,
  eventData: Record<string, any>
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  
  const content = generateSystemMessageContent(eventType, eventData)

  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      content,
      is_system: true,
      system_event_type: eventType,
      system_event_data: eventData,
      type: 'text'
    })

  if (error) throw new Error(error.message)
}

function generateSystemMessageContent(eventType: SystemEventType, data: Record<string, any>): string {
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
      case 'call_started':
        return `${data.userName || 'A user'} started a call`;
      case 'call_joined':
        return `${data.userName || 'A user'} joined the call`;
      case 'call_ended':
        return `${data.userName || 'A user'} left the call`;
      default:
        return 'Group updated';
    }
}

export async function leaveConversationAction(conversationId: string, removeAllMembers: boolean = false): Promise<void> {
    const supabase = await createSupabaseServerClient()
    const user = await getAuthenticatedUser(supabase)

    const member = await getConversationMemberAction(conversationId, user.id)
    
    // Get current user name
    const { data: currentUserData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single()
    
    if (member?.role === 'super_admin' && removeAllMembers) {
      await createSystemMessageAction(conversationId, 'member_removed', { 
        userId: 'all',
        removedBy: user.id,
        userName: 'All members'
      })
  
      const { error } = await supabase
        .from('conversation_members')
        .update({ 
          left_at: new Date().toISOString(),
          removed_by: user.id
        })
        .eq('conversation_id', conversationId)
        .is('left_at', null)
  
      if (error) throw new Error(error.message)
  
    } else {
      await createSystemMessageAction(conversationId, 'member_left', { 
        userId: user.id,
        userName: currentUserData?.name || currentUserData?.email || 'Unknown user'
      })
  
      const { error } = await supabase
        .from('conversation_members')
        .update({ left_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .is('left_at', null)
  
      if (error) throw new Error(error.message)
    }
}


export async function updateGroupImageAction(formData: FormData): Promise<string> {
    const conversationId = formData.get('conversationId') as string
    const file = formData.get('file') as File

    if (!conversationId || !file) throw new Error("Missing conversationId or file")

    const supabase = await createSupabaseServerClient()
    const user = await getAuthenticatedUser(supabase)

    // Check permissions
    const { data: conversation } = await supabase
      .from('conversations')
      .select('only_admins_can_change_image')
      .eq('id', conversationId)
      .single()

    if (conversation?.only_admins_can_change_image) {
      const member = await getConversationMemberAction(conversationId, user.id)
      if (!member || !['admin', 'super_admin'].includes(member.role)) {
        throw new Error("Only admins can change the group image")
      }
    }

    const fileExt = file.name.split(".").pop()
    const fileName = `${conversationId}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("group-images")
      .upload(fileName, file, { cacheControl: "3600", upsert: false })

    if (uploadError) throw new Error(uploadError.message)

    const { data } = supabase.storage.from("group-images").getPublicUrl(fileName)
    const publicUrl = data.publicUrl

    const { error: updateError } = await supabase
      .from("conversations")
      .update({ group_image: publicUrl })
      .eq("id", conversationId)

    if (updateError) throw new Error(updateError.message)

    await createSystemMessageAction(conversationId, 'image_changed', {
      changedBy: user.id
    })

    return publicUrl
}

// ... Additional actions like promoteToAdmin, removeMember, etc. can be added similarly.
// For brevity, ensuring the main requested ones are here. 

export async function promoteToAdminAction(conversationId: string, userId: string): Promise<void> {
    const supabase = await createSupabaseServerClient()
    const user = await getAuthenticatedUser(supabase)
  
    // Check if current user is admin
    const currentMember = await getConversationMemberAction(conversationId, user.id)
    if (!currentMember || !['admin', 'super_admin'].includes(currentMember.role)) {
      throw new Error('Only admins can promote members')
    }
  
    // Get target member to get their name
    const { data: targetUser } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single()
  
    const { error } = await supabase
      .from('conversation_members')
      .update({ role: 'admin' })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
  
    if (error) throw new Error(error.message)
  
    await createSystemMessageAction(conversationId, 'admin_promoted', { 
      userId,
      userName: targetUser?.name || targetUser?.email || 'Unknown user'
    })
}

export async function demoteFromAdminAction(conversationId: string, userId: string): Promise<void> {
    const supabase = await createSupabaseServerClient()
    const user = await getAuthenticatedUser(supabase)

    const currentMember = await getConversationMemberAction(conversationId, user.id)
    const targetMember = await getConversationMemberAction(conversationId, userId)
  
    if (!currentMember || currentMember.role !== 'super_admin') {
      throw new Error('Only super admins can demote admins')
    }
  
    if (targetMember?.role === 'super_admin') {
      throw new Error('Cannot demote super admin')
    }
  
    const { data: targetUser } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single()
  
    const { error } = await supabase
      .from('conversation_members')
      .update({ role: 'member' })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
  
    if (error) throw new Error(error.message)
  
    await createSystemMessageAction(conversationId, 'admin_demoted', { 
      userId,
      userName: targetUser?.name || targetUser?.email || 'Unknown user'
    })
}

export async function removeMemberAction(conversationId: string, userId: string): Promise<void> {
    const supabase = await createSupabaseServerClient()
    const user = await getAuthenticatedUser(supabase)
  
    const currentMember = await getConversationMemberAction(conversationId, user.id)
    const targetMember = await getConversationMemberAction(conversationId, userId)
  
    if (!currentMember || !['admin', 'super_admin'].includes(currentMember.role)) {
      throw new Error('Only admins can remove members')
    }
  
    if (targetMember?.role === 'super_admin') {
      throw new Error('Cannot remove super admin')
    }
  
    const { data: targetUser } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single()
  
    const { error } = await supabase
      .from('conversation_members')
      .update({ 
        left_at: new Date().toISOString(),
        removed_by: user.id
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
  
    if (error) throw new Error(error.message)
  
    await createSystemMessageAction(conversationId, 'member_removed', { 
      userId, 
      removedBy: user.id,
      userName: targetUser?.name || targetUser?.email || 'Unknown user'
    })
}

export async function addMembersAction(conversationId: string, memberIds: string[]): Promise<void> {
    const supabase = await createSupabaseServerClient()
    const user = await getAuthenticatedUser(supabase)
  
    if (memberIds.length === 0) return
  
    const { data: conversation } = await supabase
      .from('conversations')
      .select('only_admins_can_add_members')
      .eq('id', conversationId)
      .single()
  
    if (conversation?.only_admins_can_add_members) {
      const member = await getConversationMemberAction(conversationId, user.id)
      if (!member || !['admin', 'super_admin'].includes(member.role)) {
        throw new Error("Only admins can add members to this group")
      }
    }
  
    const { data: existingMembers } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .in('user_id', memberIds)
      .is('left_at', null)
  
    const existingMemberIds = new Set(existingMembers?.map((m: any) => m.user_id) || [])
    const newMemberIds = memberIds.filter(id => !existingMemberIds.has(id))
  
    if (newMemberIds.length === 0) return
  
    const newMembers = newMemberIds.map(userId => ({
      conversation_id: conversationId,
      user_id: userId,
      role: 'member'
    }))
  
    const { error } = await supabase
      .from('conversation_members')
      .insert(newMembers)
  
    if (error) throw new Error(error.message)
  
    for (const userId of newMemberIds) {
      const { data: addedUser } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', userId)
        .single()
  
      await createSystemMessageAction(conversationId, 'member_added', {
        userId,
        addedBy: user.id,
        userName: addedUser?.name || addedUser?.email || 'Unknown user'
      })
    }
}

export async function updateConversationSettingsAction(
    conversationId: string,
    settings: {
      only_admins_can_rename?: boolean;
      only_admins_can_add_members?: boolean;
      only_admins_can_change_image?: boolean;
    }
  ): Promise<void> {
    const supabase = await createSupabaseServerClient()
    const user = await getAuthenticatedUser(supabase)
  
    const member = await getConversationMemberAction(conversationId, user.id)
    if (!member || !['admin', 'super_admin'].includes(member.role)) {
      throw new Error("Only admins can change group settings")
    }
  
    const { error } = await supabase
      .from('conversations')
      .update(settings)
      .eq('id', conversationId)
  
    if (error) throw new Error(error.message)
}

export async function deleteConversationAction(conversationId: string): Promise<void> {
    const supabase = await createSupabaseServerClient()
    await getAuthenticatedUser(supabase)
    
    // Note: Usually should check permission first to see if user calls delete. 
    // Assuming backend policy handles RLS or we should check if they are owner/admin?
    // Current logic in original file was just delete().
    
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
  
    if (error) throw new Error(error.message)
}
