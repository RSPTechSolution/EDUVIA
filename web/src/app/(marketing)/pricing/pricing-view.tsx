"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomBuilder } from "@/components/pricing/custom-builder";
import { CycleToggle, PlanCards } from "@/components/pricing/plan-cards";
import { buttonVariants } from "@/components/ui/button";
import type { BillingCycle, Plan, PricingCatalog } from "@/lib/api/types";

export function signupHref(plan: string, cycle: BillingCycle, custom?: { modules: string[]; students: number }) {
  const q = new URLSearchParams({ plan, cycle });
  if (custom) {
    q.set("modules", custom.modules.join(","));
    q.set("students", String(custom.students));
  }
  return `/signup?${q}`;
}

export function PricingView({ plans, catalog }: { plans: Plan[]; catalog: PricingCatalog }) {
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const labels = Object.fromEntries(catalog.modules.map((m) => [m.module, m.label]));

  return (
    <>
      <div className="mt-10 flex justify-center"><CycleToggle value={cycle} onChange={setCycle} /></div>
      <div className="mt-12">
        <PlanCards
          plans={plans}
          cycle={cycle}
          moduleLabels={labels}
          renderCta={(p) => (
            <Link
              href={signupHref(p.code, cycle)}
              className={buttonVariants({ variant: p.highlight ? "default" : "outline", size: "lg", className: "h-11 w-full" })}
            >
              Start free trial
            </Link>
          )}
        />
      </div>

      <section id="custom" className="scroll-mt-24 pt-24" aria-labelledby="custom-heading">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Custom plan</p>
          <h2 id="custom-heading" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Pay only for what your school uses</h2>
          <p className="mt-4 text-lg text-muted-foreground">Choose your modules and student count. The price updates as you go.</p>
        </div>
        <div className="mt-12">
          <CustomBuilder
            catalog={catalog}
            cycle={cycle}
            renderCta={(sel, quote) => (
              <div className="space-y-2">
                <Link
                  href={signupHref("custom", cycle, sel)}
                  aria-disabled={!quote}
                  className={buttonVariants({ size: "lg", className: "h-11 w-full" })}
                >
                  Start free trial with this plan
                </Link>
                <Link
                  href={`/contact?students=${sel.students}&modules=${sel.modules.join(",")}`}
                  className={buttonVariants({ variant: "ghost", size: "lg", className: "h-10 w-full" })}
                >
                  Get a quote from our team
                </Link>
              </div>
            )}
          />
        </div>
      </section>
    </>
  );
}
