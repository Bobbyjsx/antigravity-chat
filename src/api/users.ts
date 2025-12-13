import { createClient } from "@/lib/supabase/client";
import { User } from "./types";

// --- API Definition ---
export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  const supabase = createClient();
  
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

  return data as User[];
};

export const getUserById = async (id: string): Promise<{data:User | null}> => {
  const supabase = createClient();
  const { data, error } = await supabase.from('users').select('*').eq('id', id);

  if (error) {
    console.error("Error getting user:", error);
    return {data: null};
  }

  return{ data:data[0] as User}
}

export const getViewer = async (): Promise<User | null> => {
  const supabase = createClient();
  const { data: { user:authUser } } = await supabase.auth.getUser();
  const {data: user}= await getUserById(authUser?.id!)
  if (!user) return null;

  return user;
}

export { type User };

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./queryKeys";

export const useSearchUsers = (searchTerm: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.users(searchTerm),
    queryFn: () => searchUsers(searchTerm),
    enabled: searchTerm.length > 0,
  });
};

export const useViewer = () => {
  return useQuery({
    queryKey: QUERY_KEYS.viewer,
    queryFn: getViewer,
  });
};
