
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


// Audio helper for Ringtone (Oscillator)
const playRingtone = () => {
  try {
    const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AudioContext) return null;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Simple phone ring pattern
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);
    
    // Modulation for ringing sound
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);

    osc.start();
    
    // Loop it
    const interval = setInterval(() => {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    }, 2500);

    return { ctx, osc, interval };
  } catch (e) {
    console.error("Audio error", e);
    return null;
  }
};

type CallStatus = "idle" | "calling" | "incoming" | "answering" | "connected";

interface CallContextType {
  callStatus: CallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  otherUser: User | null; 
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null); // To send signals back

  const peerRef = useRef<SimplePeerInstance | null>(null);
  const channelRef = useRef<any>(null); // For ICE candidates (still broadcast)
  const audioContextRef = useRef<any>(null); // For ringtone
  const supabase = createClient();

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

  // 2. Subscribe to Signaling Messages (Persistent DB)
  useEffect(() => {
    if (!viewer) return;

    // Listen to ALL new messages in conversations where I am a member?
    // Supabase Realtime 'INSERT' on messages.
    // We can't easily filter "conversations I am in" in the subscription filter string easily.
    // However, typical pattern is subscribing to "messages" table. RLS ensures we only see our own.
    const messageChannel = supabase
      .channel('call-signaling')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.sender_id === viewer.id) return; // Ignore own messages

          // Check if it's a call signal
          if (typeof newMsg.content === 'string' && newMsg.content.includes('::')) {
             const [prefix, data] = newMsg.content.split('::');
             
             if (['CALL_OFFER', 'CALL_ANSWER', 'CALL_HANGUP'].includes(prefix)) {
                let signalData = {};
                try {
                   signalData = JSON.parse(data);
                } catch {}

                // Fetch sender info
                // We could optimize this by including it or having it in cache
                const { data: sender } = await supabase.from('users').select('*').eq('id', newMsg.sender_id).single();
                
                if (sender) {
                   handleDBSignal(prefix, signalData, sender, newMsg.conversation_id);
                }
             }
          }
        }
      )
      .subscribe();

    return () => {
        supabase.removeChannel(messageChannel);
    };
  }, [viewer]);

  useEffect(() => {
    if (callStatus === 'incoming') {
        const audio = playRingtone();
        if(audio) audioContextRef.current = audio;

        if (document.hidden && Notification.permission === 'granted') {
             new Notification('Incoming Call', {
                 body: `${otherUser?.name || 'Unknown'} is calling you`,
                 icon: otherUser?.image 
             });
        }
    } else {
        stopRingtone();
    }
  }, [callStatus, otherUser]);

  const handleDBSignal = async (type: string, signal: any, from: User, conversationId: string) => {
     if (type === 'CALL_OFFER') {
        if (callStatus !== 'idle') return; // Busy
        
        setOtherUser(from);
        setActiveConversationId(conversationId);
        setCallStatus('incoming');
        (window as any).pendingOffer = signal;
     } 
     else if (type === 'CALL_ANSWER') {
        if (callStatus === 'calling' && peerRef.current) {
            peerRef.current.signal(signal);
            setCallStatus('connected');
        }
     }
     else if (type === 'CALL_HANGUP') {
        resetCall();
        toast("Call ended");
     }
  };

  const handleCandidate = (data: { signal: SignalData; from: User }) => {
    // Only process if from current peer
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
      // console.error("Error accessing media devices:", error);
      toast.error("Could not access camera/microphone");
      throw error;
    }
  };

  // Helper to send DB messages
  const sendDBMessage = async (type: 'CALL_OFFER' | 'CALL_ANSWER' | 'CALL_HANGUP', signal: any, conversationId: string) => {
     const content = `${type}::${JSON.stringify(signal)}`;
     await supabase.from('messages').insert({
        conversation_id: conversationId,
        content: content,
        type: 'text', // Treated as text but hidden/parsed by clients
        sender_id: viewer?.id
     });
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

  const startCall = async (user: User) => {
    if (callStatus !== "idle") return;
    
    setOtherUser(user);
    setCallStatus("calling");

    try {
      // 1. Get or Create 1-on-1 Conversation ID
      // We can reuse the API logic or do a quick check?
      // Reusing createConversation from api/conversations.ts might be best but it's an async function.
      // Importing it:
      const conversationId = await createConversation(user.id);
      setActiveConversationId(conversationId);

      const stream = await getMedia();
      
      const peer = new SimplePeer({
        initiator: true,
        trickle: true, // Enable trickle for candidates
        stream: stream,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
      });

      peer.on("signal", (data: SignalData) => {
        if (data.type === 'offer') {
            sendDBMessage('CALL_OFFER', data, conversationId);
        } else if (data.candidate) {
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
        // resetCall(); // Don't reset on minor errors, but maybe fatal ones
      });

      peerRef.current = peer;
    } catch (e) {
      console.error(e);
      setCallStatus("idle");
    }
  };

  const answerCall = async () => {
    if (callStatus !== "incoming" || !otherUser || !activeConversationId) return;
    
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

      peer.on("signal", (data: SignalData) => {
         if (data.type === 'answer') {
             sendDBMessage('CALL_ANSWER', data, activeConversationId);
         } else if (data.candidate) {
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

  const endCall = () => {
    if (otherUser && activeConversationId) {
      sendDBMessage('CALL_HANGUP', {}, activeConversationId);
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
