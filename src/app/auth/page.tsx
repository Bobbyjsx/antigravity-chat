"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "@/api/auth";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { PasswordInput } from "@components/ui/password-input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@components/ui/card";
import { getServerError } from "@/lib/https";
import toast from "react-hot-toast";

const AuthPage = () => {
  const [step, setStep] = useState<"signIn" | "signUp" | "checkEmail">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { mutateAsync: signIn, isPending: isSignInPending } = useSignIn();
  const { mutateAsync: signUp, isPending: isSignUpPending } = useSignUp();

  const isPending = isSignInPending || isSignUpPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (step === "signIn") {
        await signIn({ email, password });
      } else {
        await signUp({ email, password });
        setStep("checkEmail");
      }
    } catch (error) {
      const errMsg = getServerError(error);
      toast.error(errMsg);
      console.log({ error, errMsg });
    }
  };

  if (step === "checkEmail") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 w-full">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700 text-white">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Check your email</CardTitle>
            <CardDescription className="text-center text-gray-400">
              We've sent a confirmation link to <span className="font-medium text-white">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-400 text-center">
              Click the link in the email to verify your account and sign in.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <button
              onClick={() => setStep("signIn")}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Back to Sign In
            </button>
          </CardFooter>
        </Card>
      </div>
    );
  }

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

export default AuthPage
