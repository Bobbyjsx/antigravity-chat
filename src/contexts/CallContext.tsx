
"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import SimplePeer, { Instance as SimplePeerInstance, SignalData } from "simple-peer";
import { createClient } from "@/lib/supabase/client";
import { useViewer } from "@/api/users";
import { useNotifications } from "@/hooks/useNotifications";
import { createConversation, createSystemMessage } from "@/api/conversations";
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



// Audio helper for Ringtone (Incoming)
const playRingtone = () => {
  try {
    const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AudioContext) return null;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Digital Phone Ring pattern (higher pitch, faster)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(960, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);

    osc.start();
    
    const interval = setInterval(() => {
        if (ctx.state === 'closed') { clearInterval(interval); return; }
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(960, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    }, 2000);

    return { ctx, osc, interval };
  } catch (e) {
    return null;
  }
};

// Audio helper for Dial Tone (Outgoing)
const playDialTone = () => {
    try {
      const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioContext) return null;
      
      const ctx = new AudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
  
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
  
      // US Ringback Tone (440Hz + 480Hz)
      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      
      gain.gain.value = 0.1; 
  
      osc1.start();
      osc2.start();
      
      // 2s on, 4s off pattern
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 2);
      
      const interval = setInterval(() => {
          if (ctx.state === 'closed') { clearInterval(interval); return; }
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime + 2);
      }, 6000);
  
      return { ctx, osc: osc1, interval }; // We just return one osc to track, but cleanup cleans context
    } catch (e) {
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

          // Handle System Messages for Signaling
          if (newMsg.is_system && newMsg.system_event_type) {
             const type = newMsg.system_event_type;
             const data = newMsg.system_event_data || {};
             const signal = data.signal;

             // Map system types to internal signal types
             let signalType = '';
             if (type === 'call_started') signalType = 'CALL_OFFER';
             else if (type === 'call_joined') signalType = 'CALL_ANSWER';
             else if (type === 'call_ended') signalType = 'CALL_HANGUP';
             
             if (signalType) {
                 // Fetch sender info
                 const { data: sender } = await supabase.from('users').select('*').eq('id', newMsg.sender_id).single();
                 if (sender) {
                    handleDBSignal(signalType, signal, sender, newMsg.conversation_id);
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

  const { showCallNotification } = useNotifications();

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

  // Helper to send visible system messages for call events (Now carries signal)
  const sendCallSystemMessage = async (
      type: 'call_started' | 'call_joined' | 'call_ended', 
      conversationId: string,
      signal?: any
  ) => {
    if (!viewer) return;
    
    await createSystemMessage(
        conversationId,
        type,
        { 
            userName: viewer.name, 
            userId: viewer.id,
            signal: signal
        }
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

      peer.on("signal", (data: SignalData) => {
        if (data.type === 'offer') {
            sendCallSystemMessage("call_started", conversationId, data);
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
             sendCallSystemMessage("call_joined", activeConversationId, data);
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

  const endCall = () => {
    if (activeConversationId) {
       // Just send the ended event, which also serves as the hangup signal
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

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
