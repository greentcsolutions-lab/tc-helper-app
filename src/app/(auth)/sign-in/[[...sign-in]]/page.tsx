// src/app/(auth)/sign-in/[[...sign-in]]/page.tsx — Full 2025 Config
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"  // Footer link to sign-up
    />
  );
}