'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type CallEndReason = 'ended' | 'rejected' | 'timeout';

export async function createCallAction({
    conversationId,
    initiatorId,
    receiverId,
    offer,
    id
}: {
    conversationId: string;
    initiatorId: string;
    receiverId: string;
    offer: any;
    id?: string;
}) {
    const supabase = await createSupabaseServerClient()
    const payload: any = {
        conversation_id: conversationId,
        initiator_id: initiatorId,
        receiver_id: receiverId,
        status: 'pending',
        sdp_offer: offer
    };
    if (id) payload.id = id;

    const { data, error } = await supabase.from('calls').insert(payload).select().single();

    if (error) throw new Error(error.message);
    return data;
}

export async function answerCallAction({
    callId,
    answer
}: {
    callId: string;
    answer: any;
}) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.from('calls').update({
        status: 'active',
        sdp_answer: answer
    }).eq('id', callId).select().single();

    if (error) throw new Error(error.message);
    return data;
}

export async function endCallAction({
    callId,
    reason = 'ended'
}: {
    callId: string;
    reason?: CallEndReason;
}) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('calls').update({
        status: reason
    }).eq('id', callId);

    if (error) throw new Error(error.message);
}
