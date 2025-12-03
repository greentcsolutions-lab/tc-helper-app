// src/app/(auth)/sign-up/[[...sign-up]]/page.tsx — Full 2025 Config
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"  // Footer link to sign-in
    />
  );
}