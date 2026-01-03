"use client"
import { Sidebar } from "@modules/Chat/Sidebar";
import { useEffect } from "react";
import { useAuth } from "@api/auth";
import { useRouter } from "next/navigation";
import { usePresenceHeartbeat } from "@/api/presence";
import { useNotifications } from "@/hooks/useNotifications";

type Props = {
  children: React.ReactNode
}
import { CallProvider } from "@/contexts/call-context/CallProvider";
import { CallModal } from "@/components/modules/Call/CallModal";
import { PermissionsModal } from "@/components/modules/Permissions/PermissionsModal";

export function DashboardLayout({ children }: Props) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  
  // Track last_seen (DB for emails)
  usePresenceHeartbeat();
  useNotifications();

  useEffect(() => {
    if (!user && !isLoading) {
      router.push("/auth");
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-[100dvh] h-full bg-gray-900 text-white w-full">
      <PermissionsModal />
      <CallProvider>
        <CallModal />
        {isAuthenticated ? (
          <div className="flex h-full bg-gray-900 text-white overflow-hidden">
            <aside className="hidden sm:flex h-full">
               <Sidebar />
            </aside>
            {children}
          </div>
        ) : (
          <div>
            You are not authenticated
          </div>
        )}
      </CallProvider>
    </div>
  );
};