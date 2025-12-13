
"use client";

import React, { useRef, useState } from "react";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";
import { createClient } from "@/lib/supabase/client";
import { useViewer } from "@/api/users";
import { useNotifications } from "@/hooks/useNotifications";
import { createConversation, createSystemMessage } from "@/api/conversations";
import { User } from "@/api/types";
import toast from "react-hot-toast";
import { CallContext } from "./CallContext";
import { CallStatus } from "./types";
import { useCreateCall, useAnswerCall, useEndCall } from "@/api/calls";

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

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: viewer } = useViewer();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);

  const peerRef = useRef<SimplePeerInstance | null>(null);
  const callSubscriptionRef = useRef<any>(null); // For call updates
  const candidateQueueRef = useRef<any[]>([]); // Buffer for candidates before channel is ready
  const remoteCandidateBufferRef = useRef<any[]>([]); // Buffer for incoming candidates before peer is ready
  const audioContextRef = useRef<any>(null); // For ringtone
  const supabase = createClient();
  const { showCallNotification } = useNotifications();

  // Mutations
  const { mutateAsync: createCall } = useCreateCall();
  const { mutateAsync: answerCallMutation } = useAnswerCall();
  const { mutateAsync: endCallMutation } = useEndCall();

  const stopRingtone = () => {
    if (audioContextRef.current) {
        clearInterval(audioContextRef.current.interval);
        audioContextRef.current.osc.stop();
        audioContextRef.current.ctx.close();
        audioContextRef.current = null;
    }
  };

  const resetCall = () => {
    stopRingtone();
    setCallStatus("idle");
    setOtherUser(null);
    setRemoteStream(null);
    setActiveConversationId(null);
    setCallId(null);
    candidateQueueRef.current = [];
    remoteCandidateBufferRef.current = [];
    
    // Clean up active call subscription
    if (callSubscriptionRef.current) {
       supabase.removeChannel(callSubscriptionRef.current);
       callSubscriptionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
  };

  // --- Helper Functions ---

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      toast.error("Could not access camera/microphone");
      throw error;
    }
  };

  const processBufferedCandidates = (peer: SimplePeerInstance) => {
      if (remoteCandidateBufferRef.current.length > 0) {
          console.log(`Processing ${remoteCandidateBufferRef.current.length} buffered remote candidates`);
          remoteCandidateBufferRef.current.forEach(signal => peer.signal(signal));
          remoteCandidateBufferRef.current = [];
      }
  };

  const handleRemoteCandidate = (signal: SignalData) => {
     if (peerRef.current && !peerRef.current.destroyed) {
         peerRef.current.signal(signal);
     } else {
         console.log("Buffering incoming candidate (peer not ready)");
         remoteCandidateBufferRef.current.push(signal);
     }
  };

  // Helper: Send signaling message via Broadcast
  const sendSignal = async (type: 'answer' | 'candidate' | 'hangup', payload: any) => {
     if (callSubscriptionRef.current && viewer && (callSubscriptionRef.current.state === 'joined' || type === 'candidate')) { 
         // Note: 'candidate' might flush early, handled by queue if not ready
         await callSubscriptionRef.current.send({
            type: "broadcast",
            event: "signal",
            payload: {
               type,
               payload,
               from: viewer.id
            }
         });
     } else {
         if (type === 'candidate') {
             console.log("Buffering candidate (channel not ready)");
             candidateQueueRef.current.push(payload);
         } else {
             console.warn(`Cannot send signal ${type}: Channel not ready`);
         }
     }
  };

  // Helper: Subscribe to unified signaling channel
  const subscribeToCallUpdates = (id: string) => {
     if (callSubscriptionRef.current) supabase.removeChannel(callSubscriptionRef.current);
     
     console.log("Subscribing to call signal channel:", id);

     const channel = supabase.channel(`call:${id}`)
        .on(
            'postgres_changes',
            {
               event: 'UPDATE', // Keep DB listener for status changes (e.g. ended by timeout)
               schema: 'public',
               table: 'calls',
               filter: `id=eq.${id}`
            },
            (payload) => {
               const updated = payload.new as any;
               if (updated.status === 'ended' || updated.status === 'rejected') {
                   console.log("Call ended via DB update");
                   resetCall();
                   toast("Call ended");
               }
               // Note: We ignore 'active' DB updates for Answers now, relying on Broadcast for speed.
            }
        )
        .on(
            'broadcast', 
            { event: 'signal' }, 
            (message) => {
                const { type, payload, from } = message.payload;
                console.log(`Received signal: ${type} from ${from}`);

                // Ignore own signals
                if (from === viewer?.id) return;

                switch (type) {
                    case 'answer':
                        // Only Initiator handles Answer
                        if (peerRef.current && !peerRef.current.connected && !peerRef.current.destroyed) {
                             console.log("Processing Answer signal");
                             peerRef.current.signal(payload);
                        }
                        break;
                    case 'candidate':
                        handleRemoteCandidate(payload);
                        break;
                    case 'hangup':
                        console.log("Received Hangup signal");
                        resetCall();
                        toast("Call ended by peer");
                        break;
                }
            }
        )
        .subscribe((status) => {
            console.log(`Call channel ${id} status:`, status);
            if (status === 'SUBSCRIBED') {
                if (candidateQueueRef.current.length > 0) {
                     console.log(`Flushing ${candidateQueueRef.current.length} buffered candidates`);
                     candidateQueueRef.current.forEach(c => sendSignal('candidate', c));
                     candidateQueueRef.current = [];
                }
            }
        });
     
     callSubscriptionRef.current = channel;
  };

  // Helper to send visible system messages for logs ONLY
  const sendCallSystemMessage = async (eventType: 'call_started' | 'call_joined' | 'call_ended', conversationId: string) => {
     try {
         await createSystemMessage(conversationId, eventType, {
            callId: callId || 'unknown'
         });
     } catch(e) {
         console.error("Failed to send system message:", e);
     }
  };

  const startCall = async (user: User) => {
    if (callStatus !== "idle" || !viewer) return;
    
    setOtherUser(user);
    setCallStatus("calling");

    try {
      // Create or get conversation
      const conversationId = await createConversation(user.id);
      setActiveConversationId(conversationId);

      const stream = await getMedia();
      
      const peer = new SimplePeer({
        initiator: true,
        trickle: true,
        stream: stream,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
      });

      peer.on("signal", async (data: SignalData) => {
        if (data.type === 'offer') {
            try {
                // Create pending call row (DB Bootstrapping)
                const call = await createCall({
                    conversationId, 
                    initiatorId: viewer.id, 
                    receiverId: user.id, 
                    offer: data
                });
                
                if (call) {
                    setCallId(call.id);
                    subscribeToCallUpdates(call.id);
                    sendCallSystemMessage("call_started", conversationId);
                }
            } catch (e) {
                console.error("Failed to start call:", e);
                setCallStatus("idle");
            }
        } else if ((data as any).candidate) {
            sendSignal('candidate', data);
        }
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
      });

      // Process any early buffered candidates (unlikely for initiator but good practice)
      processBufferedCandidates(peer);

      peerRef.current = peer;
    } catch (e) {
      console.error(e);
      setCallStatus("idle");
    }
  };

  const answerCall = async () => {
    if (callStatus !== "incoming" || !otherUser || !activeConversationId || !callId) return;
    
    setCallStatus("answering");

    try {
      const stream = await getMedia();
      const offerSignal = (window as any).pendingOffer;

      const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        stream: stream,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
      });

      peer.on("signal", async (data: SignalData) => {
         if (data.type === 'answer') {
             try {
                 // 1. Send Answer via Broadcast (Fast)
                 await sendSignal('answer', data);
                 
                 // 2. Update DB for history/redundancy (Slow)
                 await answerCallMutation({ callId, answer: data });
                 sendCallSystemMessage("call_joined", activeConversationId);
             } catch (e) {
                 console.error("Failed to answer call:", e);
                 endCall();
             }
         } else if ((data as any).candidate) {
             sendSignal('candidate', data);
         }
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
      
      // Process buffered candidates from initiator
      processBufferedCandidates(peer);

      peerRef.current = peer;
    } catch (e) {
      console.error(e);
      endCall();
    }
  };

  const endCall = async () => {
    // Send Hangup signal first
    await sendSignal('hangup', null);

    if (callId) {
       try {
           await endCallMutation({ callId });
       } catch (e) {
           console.error("Error ending call:", e);
       }
    }
    if (activeConversationId) {
       sendCallSystemMessage("call_ended", activeConversationId);
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
