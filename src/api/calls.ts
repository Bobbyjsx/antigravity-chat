import { useMutation } from "@tanstack/react-query";
import { createCallAction, answerCallAction, endCallAction } from "./server-actions/call-actions";
import type { CallEndReason } from "./server-actions/call-actions";

export { type CallEndReason };

// --- Hooks ---

export const useCreateCall = () => {
    return useMutation({
        mutationFn: createCallAction
    });
};

export const useAnswerCall = () => {
    return useMutation({
        mutationFn: answerCallAction
    });
};

export const useEndCall = () => {
    return useMutation({
        mutationFn: endCallAction
    });
};

