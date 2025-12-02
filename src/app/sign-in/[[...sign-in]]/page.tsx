// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <SignIn
          routing="path"
          path="/sign-in"  // ← FIX: Required for sub-routes like /sign-in/verify
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"  // ← FIX: Replaces deprecated afterSignInUrl
        />
      </div>
    </div>
  );
}