
"use client";

import { useEffect, useRef } from "react";
import { useCall } from "@/contexts/call-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff
} from "lucide-react";

export const CallModal = () => {
  const { 
    callStatus, 
    localStream, 
    remoteStream, 
    otherUser, 
    answerCall, 
    endCall, 
    isMuted, 
    toggleMute,
    isVideoEnabled,
    toggleVideo
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus]);

  if (callStatus === "idle") return null;

  if (callStatus === "incoming") {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in">
        <div className="bg-card border shadow-lg rounded-xl p-4 w-80 flex flex-col items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={otherUser?.image || undefined} />
            <AvatarFallback>{otherUser?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h3 className="font-semibold text-lg">{otherUser?.name}</h3>
            <p className="text-muted-foreground text-sm">Incoming Video Call...</p>
          </div>
          <div className="flex gap-4 w-full">
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={endCall}
            >
              <PhoneOff className="mr-2 h-4 w-4" /> Decline
            </Button>
            <Button 
              variant="default" 
              className="bg-green-600 hover:bg-green-700 flex-1"
              onClick={answerCall}
            >
              <Phone className="mr-2 h-4 w-4" /> Accept
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Connected or Calling view
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center sm:p-4">
      <div className="relative w-full h-full sm:h-auto sm:max-w-4xl sm:aspect-video bg-black sm:rounded-lg overflow-hidden shadow-2xl border border-white/10 flex flex-col">
        
        {/* Remote Video (Main) */}
        {callStatus === "connected" && remoteStream ? (
          <div className="relative w-full h-full">
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-20 sm:bottom-4 left-4 right-4 text-white text-shadow-sm font-medium z-10 pointer-events-none">
                {otherUser?.name || "Unknown User"}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full relative">
             <div className="flex flex-col items-center gap-4 z-10">
               <Avatar className="h-24 w-24 ring-4 ring-white/10">
                  <AvatarImage src={otherUser?.image || undefined} />
                  <AvatarFallback>{otherUser?.name?.[0]}</AvatarFallback>
               </Avatar>
               <p className="text-white text-xl animate-pulse">
                 {callStatus === "calling" ? "Calling..." : "Connecting..."}
               </p>
             </div>
          </div>
        )}

        {/* Local Video (PiP) */}
        <div className="absolute top-4 right-4 w-32 sm:w-48 aspect-video bg-zinc-900 rounded-lg overflow-hidden shadow-lg border border-white/20 z-20">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
          <div className="absolute bottom-1 left-2 text-white text-[10px] sm:text-xs font-medium bg-black/40 px-1 rounded">
             You
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md p-4 rounded-full border border-white/10 z-30 mb-8 sm:mb-0">
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={toggleMute}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          <Button
            variant={!isVideoEnabled ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={toggleVideo}
          >
             {!isVideoEnabled ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="rounded-full h-14 w-14 shadow-lg hover:bg-red-600"
            onClick={endCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};
