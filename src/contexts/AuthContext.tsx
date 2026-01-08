// src/contexts/AuthContext.tsx
// Fixed 2026-01-08 – Proper TypeScript syntax for .tsx file (React + TS)
// "use client" at top for client context
// Safe types, no namespace errors

"use client";

import { createContext, useContext, ReactNode } from "react";

type AuthContextType = {
  userId: string | null;
  clerkUser: any | null; // Full Clerk user (safe to check before accessing properties)
  credits: number;
  dbUserId: string | null;
};

const AuthContext = createContext<AuthContextType>({
  userId: null,
  clerkUser: null,
  credits: 0,
  dbUserId: null,
});

export function AuthContextProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AuthContextType;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}