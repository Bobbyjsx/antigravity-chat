
"use client";

import React, { useEffect, useRef, useState } from "react";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";
import { createClient } from "@/lib/supabase/client";
import { useViewer } from "@/api/users";
import { useNotifications } from "@/hooks/useNotifications";
import { createConversation, createSystemMessage } from "@/api/conversations";
import { User } from "@/api/types";
import toast from "react-hot-toast";
import { CallContext } from "./CallContext";
import { CallStatus } from "./types";
import { playRingtone, playDialTone } from "./audio-utils";
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
  const channelRef = useRef<any>(null); // For ICE candidates
  const callSubscriptionRef = useRef<any>(null); // For call updates
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

  // 1. Subscribe to ICE candidates (Ephemeral Broadcast)
  useEffect(() => {
    if (!viewer) return;

    const channel = supabase.channel(`user:${viewer.id}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "call-candidate" }, (payload) => {
        handleCandidate(payload.payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewer]);

  // 2. Global Listener for INCOMING calls
  useEffect(() => {
    if (!viewer) return;

    const incomingChannel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${viewer.id}`
        },
        async (payload) => {
           const newCall = payload.new as any;
           if (newCall.status === 'pending' && newCall.sdp_offer) {
               // Fetch caller details
               const { data: caller } = await supabase.from('users').select('*').eq('id', newCall.initiator_id).single();
               if (caller) {
                  setOtherUser(caller);
                  setCallStatus('incoming');
                  setCallId(newCall.id);
                  setActiveConversationId(newCall.conversation_id);
                  (window as any).pendingOffer = newCall.sdp_offer;

                  // Subscribe to updates for this call (to detect hangup)
                  subscribeToCallUpdates(newCall.id);
               }
           }
        }
      )
      .subscribe();

    return () => {
        supabase.removeChannel(incomingChannel);
    };
  }, [viewer]);

  // Helper: Subscribe to specific call updates (Answer or Hangup)
  const subscribeToCallUpdates = (id: string) => {
     if (callSubscriptionRef.current) supabase.removeChannel(callSubscriptionRef.current);

     const channel = supabase.channel(`call:${id}`)
        .on(
            'postgres_changes',
            {
               event: 'UPDATE',
               schema: 'public',
               table: 'calls',
               filter: `id=eq.${id}`
            },
            (payload) => {
               const updated = payload.new as any;
               
               // Handle Hangup
               if (updated.status === 'ended' || updated.status === 'rejected') {
                   resetCall();
                   toast("Call ended");
                   return;
               }

               // Handle Answer (if I am initiator)
               if (updated.status === 'active' && updated.sdp_answer && peerRef.current && !peerRef.current.connected) {
                   // We are initiator, received answer
                   peerRef.current.signal(updated.sdp_answer);
                   setCallStatus('connected');
               }
            }
        )
        .subscribe();
     
     callSubscriptionRef.current = channel;
  };


  // Handle Audio & Notifications for state changes
  useEffect(() => {
    if (callStatus === 'incoming') {
        const audio = playRingtone();
        if(audio) audioContextRef.current = audio;

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 1000]); 
        }

        showCallNotification(
            'Incoming Call', 
            `${otherUser?.name || 'Unknown'} is calling you`, 
            otherUser?.image
        );
    } else if (callStatus === 'calling') {
         const audio = playDialTone();
         if(audio) audioContextRef.current = audio;
    } else {
        stopRingtone();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(0);
        }
    }
  }, [callStatus, otherUser]);


  const handleCandidate = (data: { signal: SignalData; from: User }) => {
    if (otherUser && data.from.id === otherUser.id && peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.signal(data.signal);
    }
  };

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

  // Helper to send ICE candidates (Broadcasting is better for high frequency)
  const sendCandidate = async (signal: any, targetUserId: string) => {
     const targetChannel = supabase.channel(`user:${targetUserId}`);
     targetChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
           await targetChannel.send({
              type: "broadcast",
              event: "call-candidate",
              payload: {
                 signal,
                 from: viewer
              }
           });
        }
     });
  };

  // Helper to send visible system messages for logs ONLY
  const sendCallSystemMessage = async (
      type: 'call_started' | 'call_joined' | 'call_ended', 
      conversationId: string
  ) => {
    if (!viewer) return;
    
    await createSystemMessage(
        conversationId,
        type,
        { userName: viewer.name, userId: viewer.id }
    );
  };

  const startCall = async (user: User) => {
    if (callStatus !== "idle") return;
    
    setOtherUser(user);
    setCallStatus("calling");

    try {
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
                // Create pending call row
                const call = await createCall({
                    conversationId, 
                    initiatorId: viewer?.id, 
                    receiverId: user.id, 
                    offer: data
                });
                
                if (call) {
                    setCallId(call.id);
                    subscribeToCallUpdates(call.id);
                    // Log system message
                    sendCallSystemMessage("call_started", conversationId);
                }
            } catch (e) {
                console.error("Failed to start call:", e);
                setCallStatus("idle");
            }
        } else if ((data as any).candidate) {
            sendCandidate(data, user.id);
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
                 // Update call with answer
                 await answerCallMutation({ callId, answer: data });
                 sendCallSystemMessage("call_joined", activeConversationId);
             } catch (e) {
                 console.error("Failed to answer call:", e);
                 endCall();
             }
         } else if ((data as any).candidate) {
             sendCandidate(data, otherUser.id);
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
      peerRef.current = peer;
    } catch (e) {
      console.error(e);
      endCall();
    }
  };

  const endCall = async () => {
    if (callId) {
       try {
           await endCallMutation({ callId });
       } catch (e) {
           console.error("Error ending call:", e);
       }
    }
    if (activeConversationId) {
       // Log system message
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
