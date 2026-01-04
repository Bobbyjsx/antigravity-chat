'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Message } from '@/api/types'

async function getAuthenticatedUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  return user
}

export async function listMessagesAction(conversationId: string): Promise<Message[]> {
  const supabase = await createSupabaseServerClient()
  // Ensure auth
  await getAuthenticatedUser(supabase) // Assuming RLS allows reading if member

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  
  return data as Message[]
}

export async function sendMessageAction(conversationId: string, content: string, type: "text" | "image" = "text"): Promise<Message> {
  const supabase = await createSupabaseServerClient()
  const user = await getAuthenticatedUser(supabase)

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      type
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as Message
}

export async function uploadMessageImageAction(formData: FormData): Promise<string> {
  const supabase = await createSupabaseServerClient()
  await getAuthenticatedUser(supabase)

  const file = formData.get('file') as File
  const conversationId = formData.get('conversationId') as string
  
  if (!file || !conversationId) throw new Error('Missing file or conversationId')

  const fileExt = file.name.split('.').pop()
  const fileName = `${conversationId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('chat-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) throw new Error(uploadError.message)

  const { data: { publicUrl } } = supabase.storage
    .from('chat-images')
    .getPublicUrl(fileName)

  return publicUrl
}

export async function markMessageAsDeliveredAction(messageId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await getAuthenticatedUser(supabase)

  const { error } = await supabase
    .from('messages')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('delivered_at', null)

  if (error) throw new Error(error.message)
}

export async function markMessageAsSeenAction(messageId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await getAuthenticatedUser(supabase)

  const { error } = await supabase
    .from('messages')
    .update({ seen_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('seen_at', null)

  if (error) throw new Error(error.message)
}
