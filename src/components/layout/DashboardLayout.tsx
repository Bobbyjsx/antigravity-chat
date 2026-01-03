"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@api/auth";
import { usePresenceHeartbeat } from "@/api/presence";
import { useNotifications } from "@/hooks/useNotifications";
import { CallProvider } from "@/contexts/call-context/CallProvider";

import { Sidebar } from "@modules/Chat/Sidebar";
import { CallModal } from "@/components/modules/Call/CallModal";
import { PermissionsModal } from "@/components/modules/Permissions/PermissionsModal";
import { PageLoader } from "../ui/Loader";

type Props = {
  children: React.ReactNode;
};

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
        {isLoading ? (
          <PageLoader />
        ) : isAuthenticated ? (
          <div className="flex h-full bg-gray-900 text-white overflow-hidden">
            <aside className="hidden sm:flex h-full">
              <Sidebar />
            </aside>
            {children}
          </div>
        ) : (
          <div className="flex h-full bg-gray-900 text-white overflow-hidden">
            You are not authenticated
          </div>
        )}
      </CallProvider>
    </div>
  );
}