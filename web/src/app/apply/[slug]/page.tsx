import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_URL } from "@/lib/auth/refresh";
import { EnquiryForm } from "./enquiry-form";

interface SchoolCard { name: string; city: string | null; phone: string | null; email: string | null; logo_url: string | null; classes: string[] }

async function getSchool(slug: string): Promise<SchoolCard | null> {
  const res = await fetch(`${API_URL}/api/v1/public/schools/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return (await res.json()).data as SchoolCard;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const school = await getSchool((await params).slug);
  return { title: school ? `Admissions · ${school.name}` : "Admissions", description: school ? `Ask about admission to ${school.name}.` : undefined };
}

/** A school's public admission enquiry form. Schools link to it from their own website. */
export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchool(slug);
  if (!school) notFound();
  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        <header className="mb-8 text-center">
          {school.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element -- the school's own logo from the API
            <img src={school.logo_url} alt="" className="mx-auto mb-4 size-16 rounded-xl object-contain" />
          )}
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">{school.name}</h1>
          <p className="mt-2 text-muted-foreground">Admission enquiry{school.city ? ` · ${school.city}` : ""}</p>
        </header>
        <EnquiryForm slug={slug} classes={school.classes} />
        {(school.phone || school.email) && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Prefer to talk? {school.phone && <a className="font-medium text-primary hover:underline" href={`tel:${school.phone}`}>{school.phone}</a>}
            {school.phone && school.email && " · "}
            {school.email && <a className="font-medium text-primary hover:underline" href={`mailto:${school.email}`}>{school.email}</a>}
          </p>
        )}
      </div>
    </main>
  );
}
