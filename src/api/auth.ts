import { createClient } from "@/lib/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

export { useAuthFromProvider as useAuth } from "@/providers/AuthProvider";

// --- API Definition ---

export const signIn = async ({ email, password }: { email: string, password: string }) => {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
};

export const signUp = async ({ email, password }: { email: string, password: string }) => {
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
};

export const signOut = async () => {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// --- React Query Hooks ---

export const useSignIn = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: signIn,
    onSuccess: () => {
      toast.success("Signed in successfully");
      router.refresh();
      // Invalidate user queries if any
      queryClient.invalidateQueries({ queryKey: ["viewer"] });
    },
  });
};

export const useSignUp = () => {
  const router = useRouter();
  
  return useMutation({
    mutationFn: signUp,
    onSuccess: () => {
      toast.success("Account created successfully! Please check your email.");
      router.refresh();
    },
  });
};

export const useSignOut = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear();
    },
  });
};

