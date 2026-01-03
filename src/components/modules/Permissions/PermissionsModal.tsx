"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Mic, Bell } from "lucide-react";
import toast from "react-hot-toast";
interface PermissionsModalProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PermissionsModal({ 
  isOpen: externalOpen, 
  onOpenChange: externalOnOpenChange 
}: PermissionsModalProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? externalOnOpenChange! : setInternalOpen;

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      // 1. Check if all permissions are already granted
      let allGranted = false;
      
      // Notification check
      const notificationGranted = Notification.permission === "granted";
      
      // Media check (if supported by permissions API)
      let mediaGranted = false;
      try {
        const cam = await navigator.permissions.query({ name: "camera" as any });
        const mic = await navigator.permissions.query({ name: "microphone" as any });
        if (cam.state === "granted" && mic.state === "granted") {
          mediaGranted = true;
        }
      } catch {
        // Fallback for browsers that don't support querying camera/mic
        // We assume false to be safe and rely on cooldown
      }

      if (notificationGranted && mediaGranted) {
        allGranted = true;
      }

      if (allGranted) return;

      // 2. Check cooldown if not all granted
      const lastAsked = localStorage.getItem("permissions_last_asked");
      const COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

      if (!lastAsked || Date.now() - parseInt(lastAsked) > COOLDOWN) {
        setOpen(true);
      }
    } catch (e) {
      console.error("Error checking permissions:", e);
    }
  };

  const grant = async () => {
    setLoading(true);
    let stream: MediaStream | null = null;
    
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      
      // Stop immediately
      stream.getTracks().forEach(t => t.stop());
      stream = null;

      if ("Notification" in window) {
        await Notification.requestPermission();
      }

      toast.success("Permissions granted");
    } catch {
      toast.error("Some permissions were denied");
    } finally {
      // Logic safety: Ensure stream is stopped if error occurred before manual stop
      if (stream) {
         (stream as MediaStream).getTracks().forEach(t => t.stop());
      }

      localStorage.setItem("permissions_last_asked", Date.now().toString());
      setLoading(false);
      setOpen(false);
      
      // Force reload to apply permissions cleanly? 
      // Often checking permissions again immediately is flaky without reload or context update.
      // But we just want to close the modal.
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="
          max-w-sm
          bg-slate-800
          border border-slate-700
          text-slate-100
        "
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-base font-medium tracking-tight">
            Permissions required
          </DialogTitle>
          <p className="text-sm text-slate-400 leading-relaxed">
            To place and receive calls, we need access to the following.
          </p>
        </DialogHeader>

        <div className="mt-5 space-y-3">
          <PermissionItem icon={<Camera />} label="Camera" />
          <PermissionItem icon={<Mic />} label="Microphone" />
          <PermissionItem icon={<Bell />} label="Notifications" />
        </div>

        <DialogFooter className="mt-6 flex-col gap-2">
          <Button
            onClick={grant}
            disabled={loading}
            className="
              w-full
              bg-slate-100
              text-slate-900
              hover:bg-slate-200
            "
          >
            {loading ? "Requesting…" : "Continue"}
          </Button>

          {/* <button
            onClick={() => {
              localStorage.setItem("permissions_granted", "true");
              setOpen(false);
            }}
            className="
              text-xs
              text-slate-500
              hover:text-slate-300
              transition
            "
          >
            Not now
          </button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-300">
      <span className="opacity-70">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
