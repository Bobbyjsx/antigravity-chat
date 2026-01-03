"use client";

import { useState, useTransition } from "react";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { PasswordInput } from "@components/ui/password-input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@components/ui/card";
import { signInAction, signUpAction } from "@/api/server-actions/auth";
import toast from "react-hot-toast";

// Define step type here or import if shared, but locally is fine for now
export type AuthStep = "signIn" | "signUp" | "checkEmail";

interface AuthFormProps {
  onSuccess: () => void;
  onCheckEmail: (email: string) => void;
}

export function AuthForm({ onSuccess, onCheckEmail }: AuthFormProps) {
  const [step, setStep] = useState<AuthStep>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    startTransition(async () => {
        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('password', password);

            if (step === "signIn") {
                const result = await signInAction(null, formData);
                if (result?.error) {
                    const errorMsg = typeof result.error === 'string' 
                        ? result.error 
                        : Object.values(result.error).flat().join(', ');
                    toast.error(errorMsg);
                    return;
                }
                toast.success("Success. Redirecting...");
                onSuccess();
            } else {
                const result = await signUpAction(null, formData);
                if (result?.error) {
                    const errorMsg = typeof result.error === 'string' 
                        ? result.error 
                        : Object.values(result.error).flat().join(', ');
                    toast.error(errorMsg);
                    return;
                } else if (result?.success) {
                    onCheckEmail(email);
                }
            }
        } catch (error) {
            console.error("Auth error:", error);
            toast.error("An unexpected error occurred");
        }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 w-full">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            {step === "signIn" ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            {step === "signIn"
              ? "Enter your credentials to access your account"
              : "Sign up to get started with Antigravity Chat"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              isLoading={isPending}
              className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-blue-500 focus:border-blue-500"
            />
            <PasswordInput
              id="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              isLoading={isPending}
              className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-blue-500 focus:border-blue-500"
            />
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              isLoading={isPending}
            >
              {step === "signIn" ? "Sign In" : "Sign Up"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <button
            onClick={() => setStep(step === "signIn" ? "signUp" : "signIn")}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {step === "signIn"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
