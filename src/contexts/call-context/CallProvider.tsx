

"use client";

import React, { useRef, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useViewer, getUserById } from "@/api/users";
import { useNotifications } from "@/hooks/useNotifications";
import { createConversation, createSystemMessage } from "@/api/conversations";
import { User } from "@/api/types";
import toast from "react-hot-toast";
import { CallContext } from "./CallContext";
import { CallStatus } from "./types";
import { useCreateCall, useAnswerCall, useEndCall } from "@/api/calls";
import { PermissionsModal } from "@/components/modules/Permissions/PermissionsModal";

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
    localCandidatesRef.current = [];
    
    // Clean up active call subscription
    if (callSubscriptionRef.current) {
       supabase.removeChannel(callSubscriptionRef.current);
       callSubscriptionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  // Check for Secure Context on mount
  useEffect(() => {
      if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
          toast.error("Warning: You are using an insecure connection (HTTP). Mobile camera access will be blocked. Please use HTTPS or localhost.", {
              duration: 10000,
              icon: '⚠️'
          });
      }
  }, []);

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
             const { data: caller } = await getUserById(newCall.initiator_id);
             
             if (caller) {
                 setOtherUser(caller);
                 setCallId(newCall.id);
                 setActiveConversationId(newCall.conversation_id);
                 setCallStatus("incoming");
                 
                 // Store offer for answerCall
                 (window as any).pendingOffer = newCall.sdp_offer;
                 
                 // Subscribe to channel immediately so we can receive candidates/answer signals
                 subscribeToCallUpdates(newCall.id);

                 // 2. Show notification
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

  // ... (existing refs)

  // ... (existing helper functions)
  


  const getMedia = async () => {
    // Basic check for support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // If not supported (e.g. insecure context), we can't do much but show modal or error
        // But for insecure context specifically, we already have a toast warning.
        // Let's trigger modal anyway to be safe/consistent if explicit check fails
        setShowPermissionModal(true);
        throw new Error("Media devices not supported or insecure context");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (error: any) {
      console.error("Error accessing media:", error);
      
      // If permission denied or unavailable, show modal to prompt user action
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

  // Helper: Send signaling message via Broadcast
  // Helper: Send signaling message via Broadcast
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
                  break;
              case 'failed':
                  console.error("ICE Connection Failed. Using STUN only might be insufficient for this network.");
                  toast.error("Call connection failed. You may be behind a restrictive firewall.");
                  break;
              case 'disconnected':
              case 'closed':
                  // Optionally handle auto-reconnect or close
                  break;
          }
      };
      
      pc.oniceconnectionstatechange = () => {
          // Monitor ice connection state
      }

      return pc;
  }

  const viewerRef = useRef<User | null>(null);
  
  useEffect(() => {
    viewerRef.current = viewer || null;
  }, [viewer]);



  // Helper: Subscribe to unified signaling channel
  const subscribeToCallUpdates = (id: string) => {
     if (callSubscriptionRef.current) supabase.removeChannel(callSubscriptionRef.current);
     
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
                        // Only Initiator handles Answer
                        if (pcRef.current && pcRef.current.signalingState !== "stable") {
                             try {
                                 const answer = new RTCSessionDescription(payload);
                                 await pcRef.current.setRemoteDescription(answer);
                                 // Flush buffered candidates now that remote description is set
                                 processRemoteCandidates(pcRef.current);
                                 
                                 // CRITICAL: Re-broadcast OUR candidates now that peer is definitely listening
                                 // This fixes the race where early broadcasts were missed
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

  // Helper to send visible system messages for logs ONLY
  const sendCallSystemMessage = async (eventType: 'call_started' | 'call_joined' | 'call_ended', conversationId: string, explicitCallId?: string) => {
     try {
         await createSystemMessage(conversationId, eventType, {
            callId: explicitCallId || callId || 'unknown'
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
      
      // 1. Generate Call ID Client-Side to Avoid Race Condition
      // (Subscribe BEFORE DB Insert so we don't miss the answer)
      const newCallId = crypto.randomUUID();
      setCallId(newCallId);
      subscribeToCallUpdates(newCallId);

      // 2. Initialize Peer Connection Immediately
      const pc = createPeerConnection();
      pcRef.current = pc;
      
      stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 3. Create DB Record (Passing pre-generated ID)
      await createCall({
          conversationId, 
          initiatorId: viewer.id, 
          receiverId: user.id, 
          offer: offer,
          id: newCallId
      });
      
      sendCallSystemMessage("call_started", conversationId, newCallId);
      
    } catch (e) {
      console.error("Failed to start call:", e);
      setCallStatus("idle");
      // Cleanup if failed
      if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          setLocalStream(null);
      }
      if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
      }
      // Clean up subscription if we failed
      if (callSubscriptionRef.current) {
         supabase.removeChannel(callSubscriptionRef.current);
         callSubscriptionRef.current = null;
      }
    }
  };

  const answerCall = async () => {
    if (callStatus !== "incoming" || !otherUser || !activeConversationId || !callId) return;
    
    setCallStatus("answering");

    try {
      const stream = await getMedia();
      const offerSignal = (window as any).pendingOffer; // This is the RTCSessionDescriptionInit

      const pc = createPeerConnection();

      stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
      });

      // Set Remote Description (Offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offerSignal));
      
      // Process buffered candidates (now that remote desc is set)
      await processRemoteCandidates(pc);

      // Create Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 1. Send Answer via Broadcast (Fast)
      await sendSignal('answer', answer);
      
      // 2. Update DB for history/redundancy (Slow)
      // If this fails (e.g. RLS, network), we should NOT kill the call since Broadcast already succeeded
      try {
          await answerCallMutation({ callId, answer: answer });
          sendCallSystemMessage("call_joined", activeConversationId);
      } catch (dbError) {
          console.error("Failed to update call status in DB (non-fatal):", dbError);
          toast.error("Call established, but status update failed.");
      }
      
      pcRef.current = pc;
    } catch (e) {
      console.error("Failed to answer call:", e);
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
      <PermissionsModal 
         isOpen={showPermissionModal} 
         onOpenChange={setShowPermissionModal}
      />
      {children}
    </CallContext.Provider>
  );
};
