
"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";
import { createClient } from "@/lib/supabase/client";
import { useViewer } from "@/api/users";
import { User } from "@/api/types";
import toast from "react-hot-toast";

// Polyfills for simple-peer
import * as process from "process";
if (typeof window !== "undefined") {
  (window as any).process = process;
  (window as any).global = window;
}
import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}

type CallStatus = "idle" | "calling" | "incoming" | "connected";

interface CallContextType {
  callStatus: CallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  otherUser: User | null; // The person we are calling or who is calling us
  startCall: (user: User) => Promise<void>;
  answerCall: () => void;
  endCall: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  isVideoEnabled: boolean;
  toggleVideo: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: viewer } = useViewer();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const peerRef = useRef<SimplePeerInstance | null>(null);
  const channelRef = useRef<any>(null); // Supabase Realtime channel
  const supabase = createClient();

  // Reset state helper
  const resetCall = () => {
    setCallStatus("idle");
    setOtherUser(null);
    setRemoteStream(null);
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
  };

  // Subscribe to my own channel for incoming signals
  useEffect(() => {
    if (!viewer) return;

    const channel = supabase.channel(`user:${viewer.id}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "call-signal" }, (payload) => {
        handleSignal(payload.payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewer]);

  const handleSignal = async (data: { type: string; signal: SignalData; from: User }) => {
    // Prevent handling own signals
    if (data.from.id === viewer?.id) return;

    if (data.type === "offer") {
      // Incoming call
      if (callStatus !== "idle") {
        // Busy - maybe send busy signal?
        return;
      }
      setOtherUser(data.from);
      setCallStatus("incoming");
      // Store offer for answering
      // We don't verify peer yet, wait for answer
      // But actually we need to verify peer later.
      // For now, simple-peer needs to be initialized only when answering.
      // We can store the signal to pass it later.
      (window as any).pendingOffer = data.signal; 
    } else if (data.type === "answer") {
      // We are calling, they answered
      if (callStatus === "calling" && peerRef.current) {
        peerRef.current.signal(data.signal);
        setCallStatus("connected");
      }
    } else if (data.type === "candidate") {
      // ICE candidate
      if (peerRef.current) {
        peerRef.current.signal(data.signal);
      }
    } else if (data.type === "hangup") {
      resetCall();
      toast("Call ended");
    }
  };

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast.error("Could not access camera/microphone");
      throw error;
    }
  };

  const sendSignal = async (type: string, signal: any, targetUserId: string) => {
    if (!viewer) return;
    
    // Broadcast to target user's channel
    // Note: We are using "broadcast" which sends to everyone subscribed to the channel.
    // The target user should be subscribed to `user:${targetUserId}`.
    // We (the sender) must also subscribe/publish to that channel or use a global mechanism?
    // Supabase Broadcast sends to users CONNECTED to that channel. 
    // So we need to connect to target user's channel temporarily to send, or 
    // rely on a global design.
    // BETTER DESIGN: Everyone subscribes to their OWN channel `user:MY_ID`.
    // To call someone, I send a message to `user:THEIR_ID`.
    
    const targetChannel = supabase.channel(`user:${targetUserId}`);
    targetChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await targetChannel.send({
          type: "broadcast",
          event: "call-signal",
          payload: {
             type,
             signal,
             from: viewer
          }
        });
        // We can unsubscribe after sending? No, keep it open for candidates?
        // Actually for candidates we might stream them.
        // Ideally we keep connection open.
      }
    });
  };

  const startCall = async (user: User) => {
    if (callStatus !== "idle") return;
    
    setOtherUser(user);
    setCallStatus("calling");

    try {
      const stream = await getMedia();
      
      const peer = new SimplePeer({
        initiator: true,
        trickle: false, // Simple setup first
        stream: stream,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
      });

      peer.on("signal", (data: SignalData) => {
        sendSignal("offer", data, user.id);
      });

      peer.on("stream", (stream: MediaStream) => {
        setRemoteStream(stream);
      });
      
      peer.on("connect", () => {
        setCallStatus("connected");
      });

      peer.on("close", () => {
        resetCall();
      });

      peer.on("error", (err: Error) => {
        console.error("Peer error:", err);
        resetCall();
        toast.error("Call connection failed");
      });

      peerRef.current = peer;
    } catch (e) {
      setCallStatus("idle");
    }
  };

  const answerCall = async () => {
    if (callStatus !== "incoming" || !otherUser) return;

    try {
      const stream = await getMedia();
      
      // Retrieve stored offer
      const offerSignal = (window as any).pendingOffer;

      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: stream,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
      });

      peer.on("signal", (data: SignalData) => {
        sendSignal("answer", data, otherUser.id);
      });

      peer.on("stream", (stream: MediaStream) => {
        setRemoteStream(stream);
      });
      
      peer.on("connect", () => {
        setCallStatus("connected");
      });
      
      peer.on("close", () => {
        resetCall();
      });

      peer.on("error", (err: Error) => {
        console.error("Peer error:", err);
        resetCall();
      });

      peer.signal(offerSignal);
      peerRef.current = peer;
    } catch (e) {
      console.error(e);
      endCall();
    }
  };

  const endCall = () => {
    if (otherUser) {
      sendSignal("hangup", {}, otherUser.id);
    }
    resetCall();
  };

  const toggleMute = () => {
    if (localStream) {
       localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
       setIsMuted(!localStream.getAudioTracks()[0]?.enabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
       localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
       setIsVideoEnabled(!!localStream.getVideoTracks()[0]?.enabled);
    }
  };

  return (
    <CallContext.Provider
      value={{
        callStatus,
        localStream,
        remoteStream,
        otherUser,
        startCall,
        answerCall,
        endCall,
        isMuted,
        toggleMute,
        isVideoEnabled,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
