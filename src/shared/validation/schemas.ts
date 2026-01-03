import { z } from 'zod';

export const userSchemas = {
  signIn: z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
  
  signUp: z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      // .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number') // Simplified for now
      ,
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),
  
  profile: z.object({
    name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
    bio: z.string().max(200, 'Bio too long').optional(),
  }),
} as const;

export const messageSchemas = {
  send: z.object({
    content: z.string()
      .min(1, 'Message cannot be empty')
      .max(1000, 'Message too long')
      .refine((val) => val.trim().length > 0, 'Message cannot be empty'),
    conversationId: z.string().uuid('Invalid conversation ID'),
  }),
} as const;

export const callSchemas = {
    start: z.object({
        userId: z.string().uuid('Invalid user ID')
    }),
    signal: z.object({
        type: z.enum(['answer', 'offer', 'candidate', 'hangup']),
        payload: z.any(),
        to: z.string().uuid().optional(),
    })
} as const;
