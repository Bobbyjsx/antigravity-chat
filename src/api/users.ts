import { User } from "./types";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "./queryKeys";
import { getUserSession } from "./server-actions/auth";
import { getOnlineUsersAction, getUserByIdAction, searchUsersAction } from "./server-actions/user-actions";

// --- API Definition ---
export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  return (await searchUsersAction(searchTerm)) as User[];
};


export const getViewer = async (): Promise<User | null> => {
  const { session} = await getUserSession();
  if (!session) return null;

  const {user}= await getUserByIdAction(session.user.id)
  if (!user) return null;

  return user;
}

export { type User };



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

export const useGetOnlineUsers = <TData = any>(
  options?: Omit<import("@tanstack/react-query").UseQueryOptions<any, Error, TData>, "queryKey" | "queryFn">
) => {

  const queryFn = () => {
    try{
      return getOnlineUsersAction();
    }catch(error){
      console.error("Error fetching online users:", error);
      return [];
    }
  };
  
  return useQuery({
    queryKey: QUERY_KEYS.onlineUsers,
    queryFn: queryFn,
    ...options,
  });
};