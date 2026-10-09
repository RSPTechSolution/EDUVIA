import type { Metadata } from "next";
import { Suspense } from "react";
import { SignIn } from "./sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your school&apos;s Vidyanexa workspace.</p>
      </div>
      <Suspense>
        <SignIn />
      </Suspense>
    </>
  );
}
