
import { User } from "@/api/types";

export type CallStatus = "idle" | "calling" | "incoming" | "answering" | "connected";

export interface CallContextType {
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
