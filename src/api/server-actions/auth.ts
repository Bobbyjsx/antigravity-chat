'use server'
import { clientConfig } from '@/config/environment'
import { userSchemas } from '@/shared/validation/schemas'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'



export async function signInAction(_prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validate input
  const validatedFields = userSchemas.signIn.safeParse({ email, password })

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors, data: null }
  }

  const supabase = await createSupabaseServerClient()

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

return { error: error?.message ?? null, data }
}

export async function signUpAction(_prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  // Note: We might not have confirmPassword in the form data if we just grab simple fields, 
  // but let's assume the form provides it or we validate partial.
  // For this action, we'll just validate email/password for the Supabase call.
  // Ideally front-end sends confirmPassword too.

  // Let's assume the form sends it.
  // If not, we validate just what we need for the API.
  
  const validationSchema = z.object({
      email: z.string().email(),
      password: z.string().min(8)
  })

  const validatedFields = validationSchema.safeParse({ email, password })

  if (!validatedFields.success) {
      return { error: validatedFields.error.flatten().fieldErrors }
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${clientConfig.appUrl}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
