import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@components/ui/card";

interface CheckEmailCardProps {
  email: string;
  onBack: () => void;
}

export function CheckEmailCard({ email, onBack }: CheckEmailCardProps) {
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
            onClick={onBack}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Back to Sign In
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
