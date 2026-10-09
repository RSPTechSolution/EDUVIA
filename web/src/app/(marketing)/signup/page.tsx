import type { Metadata } from "next";
import { Suspense } from "react";
import { GlowBackdrop } from "@/components/marketing/section";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Start your free trial",
  description: "Create your school on Vidyanexa in a minute. 14-day free trial, no card needed.",
};

export default function SignupPage() {
  return (
    <section className="relative isolate overflow-hidden px-5 py-16 sm:px-8 lg:py-20">
      <GlowBackdrop />
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">Start your free trial</h1>
          <p className="mt-4 text-lg text-muted-foreground">Your school will be ready in under a minute. Free for 14 days, no card needed.</p>
        </div>
        <Suspense>
          <SignupForm />
        </Suspense>
      </div>
    </section>
  );
}
