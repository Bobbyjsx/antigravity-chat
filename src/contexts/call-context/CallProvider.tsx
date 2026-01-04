

"use client";

import React, { useRef, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useViewer } from "@/api/users";
import { useNotifications } from "@/hooks/useNotifications";
import { createConversation, createSystemMessage } from "@/api/conversations";
import { User } from "@/api/types";
import toast from "react-hot-toast";
import { CallContext } from "./CallContext";
import { CallStatus } from "./types";
import { useCreateCall, useAnswerCall, useEndCall } from "@/api/calls";
import { PermissionsModal } from "@/components/modules/Permissions/PermissionsModal";
import { getUserByIdAction } from "@/api/server-actions/user-actions";

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callSubscriptionRef = useRef<any>(null); // For call updates
  const candidateQueueRef = useRef<any[]>([]); // Buffer for sending candidates before channel is ready
  const localCandidatesRef = useRef<any[]>([]); // Store all local candidates to re-send on answer
  const remoteCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]); // Buffer for incoming candidates before remote desc is set
  const audioContextRef = useRef<any>(null); // For ringtone
  const supabase = createClient();
  const { showCallNotification } = useNotifications();

  // Mutations
  const { mutateAsync: createCall } = useCreateCall();
  const { mutateAsync: answerCallMutation } = useAnswerCall();
  const { mutateAsync: endCallMutation } = useEndCall();

  const playTone = (type: 'ring' | 'dial') => {
    if (audioContextRef.current) return;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'ring') {
        // Incoming call: Higher pitch, urgent
        osc.type = 'sine';
        osc.frequency.value = 880; 
        gainNode.gain.value = 0.1;

        let isOn = true;
        const interval = setInterval(() => {
            if (ctx.state === 'closed') return;
            const now = ctx.currentTime;
            if (isOn) {
                gainNode.gain.cancelScheduledValues(now);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.linearRampToValueAtTime(0, now + 1.0);
            }
            isOn = !isOn;
        }, 2000);
        audioContextRef.current = { ctx, osc, interval };
    } else {
        // Outgoing call (Dialing): Lower pitch, steady pulse
        osc.type = 'sine';
        osc.frequency.value = 440; 
        gainNode.gain.value = 0.1;
        
        let isOn = true;
        const interval = setInterval(() => {
            if (ctx.state === 'closed') return;
            const now = ctx.currentTime;
            if (isOn) {
                gainNode.gain.setValueAtTime(0.1, now);
            } else {
                gainNode.gain.setValueAtTime(0, now);
            }
            isOn = !isOn;
        }, 2000); // 2s pattern
         audioContextRef.current = { ctx, osc, interval };
    }

    osc.start();
  };

  const stopTone = () => {
    if (audioContextRef.current) {
        if (audioContextRef.current.interval) clearInterval(audioContextRef.current.interval);
        try {
          if (audioContextRef.current.osc) audioContextRef.current.osc.stop();
          if (audioContextRef.current.ctx) audioContextRef.current.ctx.close();
        } catch (e) {
            console.error("Error stopping tone", e);
        }
        audioContextRef.current = null;
    }
  };

  const resetCall = () => {
    stopTone();
    setCallStatus("idle");
    setOtherUser(null);
    setRemoteStream(null);
    setActiveConversationId(null);
    setCallId(null);
    candidateQueueRef.current = [];
    remoteCandidateBufferRef.current = [];
    localCandidatesRef.current = [];
    
    // Clean up active call subscription
    if (callSubscriptionRef.current) {
       supabase.removeChannel(callSubscriptionRef.current);
       callSubscriptionRef.current = null;
    }

    // Cleanup using REF (Fixes stale closure issue)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
      });
      localStreamRef.current = null;
    }
    setLocalStream(null);
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  // ... (Secure Context Check omitted) ...

  // Listen for incoming calls
  useEffect(() => {
    if (!viewer) return;

    const channel = supabase.channel(`incoming-calls:${viewer.id}`)
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
          if (newCall.status === 'pending') {
             // 1. Fetch caller details
             const { user: caller } = await getUserByIdAction(newCall.initiator_id);
             
             if (caller) {
                 setOtherUser(caller);
                 setCallId(newCall.id);
                 setActiveConversationId(newCall.conversation_id);
                 setCallStatus("incoming");
                 
                 // Store offer for answerCall
                 (window as any).pendingOffer = newCall.sdp_offer;
                 
                 // Subscribe to channel immediately so we can receive candidates/answer signals
                 subscribeToCallUpdates(newCall.id);

                 // 2. Play Ringtone & Show notification
                 playTone('ring');
                 showCallNotification(
                     "Incoming Call", 
                     `Incoming call from ${caller.name || caller.email}`
                 );
             }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewer, showCallNotification]); 

  // --- Helper Functions ---

  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const viewerRef = useRef<User | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  useEffect(() => {
    viewerRef.current = viewer || null;
  }, [viewer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  }, []);

  const getMedia = async () => {
    // Basic check for support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setShowPermissionModal(true);
        throw new Error("Media devices not supported or insecure context");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream; // Keep ref in sync
      return stream;
    } catch (error: any) {
      console.error("Error accessing media:", error);
      
      if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
          setShowPermissionModal(true);
      }
      
      let msg = "Could not access camera/microphone";
      if (error.name === 'NotAllowedError') msg = "Permission denied for camera/microphone";
      if (error.name === 'NotFoundError') msg = "No camera or microphone found";
      if (error.name === 'NotReadableError') msg = "Camera/Microphone is already in use";
      toast.error(msg);
      throw error;
    }
  };

  const sendSignal = async (type: 'answer' | 'candidate' | 'hangup', payload: any) => {
     // Check if channel is actually joined
     const isJoined = callSubscriptionRef.current?.state === 'joined';
     
     if (callSubscriptionRef.current && viewer && isJoined) { 
         try {
             await callSubscriptionRef.current.send({
                type: "broadcast",
                event: "signal",
                payload: {
                   type,
                   payload,
                   from: viewer.id
                }
             });
         } catch (err) {
             console.error(`Failed to send signal ${type}:`, err);
         }
     } else {
         if (type === 'candidate') {
             candidateQueueRef.current.push(payload);
         }
     }
  };
  
  const processRemoteCandidates = async (pc: RTCPeerConnection) => {
      if (remoteCandidateBufferRef.current.length > 0) {
          for (const candidateInit of remoteCandidateBufferRef.current) {
               try {
                   await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
               } catch (e) {
                   console.error("Error processing buffered candidate", e);
               }
          }
          remoteCandidateBufferRef.current = [];
      }
  }

  const sendCallSystemMessage = async (eventType: 'call_started' | 'call_joined' | 'call_ended', conversationId: string, explicitCallId?: string) => {
     try {
         await createSystemMessage(conversationId, eventType, {
            callId: explicitCallId || callId || 'unknown',
            userName: viewer?.name || viewer?.email || 'Unknown User',
            userId: viewer?.id
         });
     } catch(e) {
         console.error("Failed to send system message:", e);
     }
  };

  const createPeerConnection = () => {
      const pc = new RTCPeerConnection(ICE_SERVERS); 

      pc.onicecandidate = (event) => {
          if (event.candidate) {
              const candidate = event.candidate.toJSON();
              localCandidatesRef.current.push(candidate);
              sendSignal('candidate', candidate);
          }
      };

      pc.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
      };

      pc.onconnectionstatechange = () => {
          switch(pc.connectionState) {
              case 'connected':
                  setCallStatus("connected");
                  stopTone(); 
                  break;
              case 'failed':
                  console.error("ICE Connection Failed. Using STUN only might be insufficient for this network.");
                  toast.error("Call connection failed. You may be behind a restrictive firewall.");
                  break;
              case 'disconnected':
              case 'closed':
                  stopTone();
                  break;
          }
      };
      
      return pc;
  }

  // Helper: Subscribe to unified signaling channel
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
               if (updated.status === 'ended' || updated.status === 'rejected') {
                   resetCall();
                   toast("Call ended");
               }
            }
        )
        .on(
            'broadcast', 
            { event: 'signal' }, 
            async (message) => {
                const { type, payload, from } = message.payload;

                // Ignore own signals
                const currentViewerId = viewerRef.current?.id;
                if (currentViewerId && from === currentViewerId) return;

                switch (type) {
                    case 'answer':
                        stopTone(); // Caller: Stop dial tone when answered
                        // Only Initiator handles Answer
                        if (pcRef.current && pcRef.current.signalingState !== "stable") {
                             try {
                                 const answer = new RTCSessionDescription(payload);
                                 await pcRef.current.setRemoteDescription(answer);
                                 processRemoteCandidates(pcRef.current);
                                 if (localCandidatesRef.current.length > 0) {
                                     localCandidatesRef.current.forEach(c => sendSignal('candidate', c));
                                 }
                             } catch (e) {
                                 console.error("Error setting remote description (answer):", e);
                             }
                        }
                        break;
                    case 'candidate':
                         if (payload) {
                             const candidate = new RTCIceCandidate(payload);
                             if (pcRef.current && pcRef.current.remoteDescription) {
                                 pcRef.current.addIceCandidate(candidate).catch(e => console.error("Error adding Ice Candidate", e));
                             } else {
                                 remoteCandidateBufferRef.current.push(payload);
                             }
                         }
                        break;
                    case 'hangup':
                        resetCall();
                        toast("Call ended by peer");
                        break;
                }
            }
        )
        .subscribe((status) => {
             if (status === 'SUBSCRIBED') {
                if (candidateQueueRef.current.length > 0) {
                     candidateQueueRef.current.forEach(c => sendSignal('candidate', c));
                     candidateQueueRef.current = [];
                }
            }
        });
     
     callSubscriptionRef.current = channel;
  };

  const startCall = async (user: User) => {
    if (callStatus !== "idle" || !viewer) return;
    
    setOtherUser(user);
    setCallStatus("calling");
    playTone('dial'); 

    try {
      const conversationId = await createConversation(user.id);
      setActiveConversationId(conversationId);

      const stream = await getMedia();
      
      const newCallId = crypto.randomUUID();
      setCallId(newCallId);
      subscribeToCallUpdates(newCallId);

      const pc = createPeerConnection();
      pcRef.current = pc;
      
      stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await createCall({
          conversationId, 
          initiatorId: viewer.id, 
          receiverId: user.id, 
          offer: { type: offer.type, sdp: offer.sdp },
          id: newCallId
      });
      
      sendCallSystemMessage("call_started", conversationId, newCallId);
      
    } catch (e) {
      console.error("Failed to start call:", e);
      setCallStatus("idle");
      stopTone(); 
      if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          setLocalStream(null);
      }
      if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
      }
      if (callSubscriptionRef.current) {
         supabase.removeChannel(callSubscriptionRef.current);
         callSubscriptionRef.current = null;
      }
    }
  };

  const answerCall = async () => {
    if (callStatus !== "incoming" || !otherUser || !activeConversationId || !callId) return;
    
    stopTone(); 
    setCallStatus("answering");

    try {
      const stream = await getMedia();
      const offerSignal = (window as any).pendingOffer; 

      const pc = createPeerConnection();

      stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offerSignal));
      await processRemoteCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal('answer', answer);
      
      try {
          await answerCallMutation({ callId, answer: { type: answer.type, sdp: answer.sdp } });
          sendCallSystemMessage("call_joined", activeConversationId);
      } catch (dbError) {
          console.error("Failed to update call status in DB:", dbError);
      }
      
      pcRef.current = pc;
    } catch (e) {
      console.error("Failed to answer call:", e);
      endCall();
    }
  };

  const endCall = async () => {
    stopTone(); 
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
      <PermissionsModal 
         isOpen={showPermissionModal} 
         onOpenChange={setShowPermissionModal}
      />
      {children}
    </CallContext.Provider>
  );
};
