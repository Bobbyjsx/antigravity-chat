import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOutAction } from "./server-actions/auth";

export { useAuthFromProvider as useAuth } from "@/providers/AuthProvider";

export const useSignOut = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOutAction,
    onSuccess: () => {
      queryClient.clear();
    },
  });
};

