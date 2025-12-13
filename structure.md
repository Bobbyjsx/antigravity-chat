# Project Structure & Patterns

## API Layer (`src/api`)

All API interactions should be centralized in the `src/api` directory.

### File Organization
- **Single Feature/Resource**: If a feature has few endpoints, group them in a single file (e.g., `src/api/auth.ts`).
- **Complex Feature**: If a feature has many endpoints or complex logic, create a folder and split files by operation (e.g., `src/api/messages.ts`).

### Implementation Pattern
Each API file should adhere to the following pattern:
1.  **Define the API Call**: Create an async function using the Supabase client from `@/lib/supabase/client`.
2.  **Export a Hook**: Create and export a custom React Query hook (`useQuery` or `useMutation`) that uses the API function.

### Error Handling
- **Display**: Use `react-hot-toast` to display error messages to the user, typically within the `onError` callback of mutations.

### Example

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "react-hot-toast";

// --- API Definition ---
export const fetchMessages = async (conversationId: string) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId);
    
  if (error) throw error;
  return data;
};

export const sendMessage = async (payload: { conversationId: string; content: string }) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

// --- React Query Hooks ---
export const useMessages = (conversationId: string) => {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => fetchMessages(conversationId),
    enabled: !!conversationId,
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", variables.conversationId] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
```

## Components

- **UI Components**: generic, reusable components go in `src/components/ui` (e.g., Button, Input).
- **Feature Components**: feature-specific components go in `src/components/<Feature>` (e.g., `src/components/Chat`).
