/** Long-form legal text with a sticky table of contents. */
export function LegalPage({
  title, updated, intro, sections,
}: { title: string; updated: string; intro: React.ReactNode; sections: { id: string; title: string; body: React.ReactNode }[] }) {
  return (
    <div className="px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
          <div className="mt-6 text-lg text-muted-foreground">{intro}</div>
        </header>
        <div className="mt-12 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="On this page" className="hidden lg:block">
            <ol className="sticky top-24 space-y-2 border-l text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px block border-l border-transparent pl-4 text-muted-foreground hover:border-foreground hover:text-foreground">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="max-w-3xl space-y-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-2xl font-bold">{i + 1}. {s.title}</h2>
                <div className="mt-4 space-y-4 leading-relaxed text-foreground/85 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
