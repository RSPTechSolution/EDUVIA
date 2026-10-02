import { School } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-brand-50 dark:bg-background">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
              <School className="h-6 w-6 text-primary-foreground" aria-hidden />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              SchoolERP
            </span>
          </div>
          <div className="mt-8">
            {children}
          </div>
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 bg-primary h-full w-full object-cover">
          <div className="flex h-full flex-col justify-center p-16 text-primary-foreground">
            <h1 className="text-display-md font-bold mb-6">Manage your school<br />effortlessly.</h1>
            <p className="text-xl max-w-xl text-primary-foreground/80">
              The modern, unified platform for academics, finance, and operations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
