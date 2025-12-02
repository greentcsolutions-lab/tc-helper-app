// src/app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <SignUp
          routing="path"
          path="/sign-up"  // ← FIX: Required for sub-routes like /sign-up/verify
          signInUrl="/sign-in"
          fallbackRedirectUrl="/dashboard"  // ← FIX: Replaces deprecated afterSignUpUrl
        />
      </div>
    </div>
  );
}