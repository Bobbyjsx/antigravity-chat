
import { createClient } from "@/lib/supabase/client";
import { SignalData } from "simple-peer";
import { useMutation } from "@tanstack/react-query";

export type CallEndReason = 'ended' | 'rejected' | 'timeout';

// --- API Functions ---

export const createCall = async ({
    conversationId,
    initiatorId,
    receiverId,
    offer
}: {
    conversationId: string;
    initiatorId: string;
    receiverId: string;
    offer: SignalData;
}) => {
    const supabase = createClient();
    const { data, error } = await supabase.from('calls').insert({
        conversation_id: conversationId,
        initiator_id: initiatorId,
        receiver_id: receiverId,
        status: 'pending',
        sdp_offer: offer
    }).select().single();

    if (error) throw error;
    return data;
};

export const answerCall = async ({
    callId,
    answer
}: {
    callId: string;
    answer: SignalData;
}) => {
    const supabase = createClient();
    const { data, error } = await supabase.from('calls').update({
        status: 'active',
        sdp_answer: answer
    }).eq('id', callId).select().single();

    if (error) throw error;
    return data;
};

export const endCall = async ({
    callId,
    reason = 'ended'
}: {
    callId: string;
    reason?: CallEndReason;
}) => {
    const supabase = createClient();
    const { error } = await supabase.from('calls').update({
        status: reason
    }).eq('id', callId);

    if (error) throw error;
};

// --- Hooks ---

export const useCreateCall = () => {
    return useMutation({
        mutationFn: createCall
    });
};

export const useAnswerCall = () => {
    return useMutation({
        mutationFn: answerCall
    });
};

export const useEndCall = () => {
    return useMutation({
        mutationFn: endCall
    });
};

