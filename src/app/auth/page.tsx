"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "./components/AuthForm";
import { CheckEmailCard } from "./components/CheckEmailCard";

const AuthPage = () => {
  const [step, setStep] = useState<"auth" | "checkEmail">("auth");
  const [email, setEmail] = useState("");

  const router = useRouter();
  const dashboardRoute = '/chat';

  useEffect(() => {
    router.prefetch(dashboardRoute);
  }, [router, dashboardRoute]);

  const handleAuthSuccess = () => {
    // Force full page reload to ensure AuthProvider picks up the new session cookie
    window.location.href = dashboardRoute;
  };

  const handleCheckEmail = (email: string) => {
    setEmail(email);
    setStep("checkEmail");
  };

  const handleBackToSignIn = () => {
    setStep("auth");
  };

  if (step === "checkEmail") {
    return <CheckEmailCard email={email} onBack={handleBackToSignIn} />;
  }

  return <AuthForm onSuccess={handleAuthSuccess} onCheckEmail={handleCheckEmail} />;
}

export default AuthPage
