"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getUserByIdAction = async (userId: string) => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('users').select('*').eq('id', userId);
  if (error) return { error: error.message, user: null };

  return { user: data[0] }
};

export const updateUserPresenceAction = async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('user_presence')
    .upsert({
      user_id: userId,
      last_seen: new Date().toISOString(),
      is_online: true, 
    });
};

export const getOnlineUsersAction = async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('user_presence')
    .select('user_id, last_seen, is_online');

  if (error) throw new Error(error.message);

  return data;
};

export const searchUsersAction = async (searchTerm: string) => {
  const supabase = await createSupabaseServerClient();
  
  // Assuming a 'profiles' table or similar that is searchable
  // If searching auth.users, this requires a secure server-side function or specific RLS
  // For now, querying a public 'users' table
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', `%${searchTerm}%`); // Simple search by email for now

  if (error) {
    console.error("Error searching users:", error);
    return [];
  }

  return data;
};

// Update user profile (name, image)
export const updateProfileAction = async (data: { name?: string; image?: string }) => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("users")
    .update(data)
    .eq("id", user.id);

  if (error) throw new Error(error.message);
};

// Upload avatar image
export const uploadAvatarAction = async (formData: FormData): Promise<string> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const fileExt = file.name.split(".").pop();
  const fileName = `${user.id}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  // Update user profile with new image URL
  await updateProfileAction({ image: publicUrl });

  return publicUrl;
};