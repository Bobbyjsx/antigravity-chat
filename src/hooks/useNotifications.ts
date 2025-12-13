import { useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useViewer } from "@/api/users";

export function useNotifications() {
  const { data: user } = useViewer();
  const supabase = createClient();
  const channelRef = useRef<any>(null);

  // Manual request button (optional)
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    return await Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (!user) return;

    // ---- REQUEST PERMISSION ON USER ACTION (REQUIRED ON MOST BROWSERS) ----
    const interactiveRequest = async () => {
      if (!("Notification" in window)) return;
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    };

    // First attempt (won't work unless Chrome thinks it’s user initiated)
    interactiveRequest();

    // Real guaranteed attempt
    const clickHandler = () => interactiveRequest();
    window.addEventListener("click", clickHandler, { once: true });

    // ---- SUPABASE REALTIME SETUP ----
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const m = payload.new as any;

          if (!m) return;

          // Skip our own messages
          if (m.sender_id === user.id) return;
          if (document.visibilityState === "visible") return;
          
          if (Notification.permission === "granted") {
            const n = new Notification("New Message", {
              body: m.content || "You have a new message",
              icon: "/vite.svg",
              tag: m.conversation_id, // merges conversation threads
              requireInteraction: false,
            });
            // OPTIONAL: handle click
            n.onclick = () => {
              window.focus();
            };
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      window.removeEventListener("click", clickHandler);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user]);

  // Helper for call notifications
  const showCallNotification = useCallback((title: string, body: string, icon?: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    
    // Only show if window is hidden
    if (document.visibilityState === "visible") return;

    const n = new Notification(title, {
      body,
      icon: icon || "/vite.svg",
      tag: 'incoming-call', 
      requireInteraction: true, // Calls are important
    });
    
    n.onclick = () => {
        window.focus();
        n.close();
    };
  }, []);

  return { requestPermission, showCallNotification };
}
