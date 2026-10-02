'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ChevronRight, ShieldCheck, Zap, Users, BarChart3, GraduationCap, Building } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-24 items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
                <img src="/logo_transparent.png" alt="EDUVIA Logo" className="h-16 sm:h-20 w-auto object-contain" />
              </Link>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#services" className="text-sm font-medium text-muted-foreground hover:text-foreground">Services</Link>
              <Link href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground">Who We Are</Link>
              <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">Sign In</Link>
              <Button asChild>
                <Link href="/login">Get Started</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-background -z-10" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-foreground mb-6">
              The Modern OS for <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">Smart Schools</span>
            </h1>
            <p className="mt-4 text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
              EDUVIA is the all-in-one educational platform that unifies academics, finance, operations, and communication. Experience effortless school management.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild className="h-12 px-8 text-base">
                <Link href="/login">
                  Access Dashboard <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                Book a Demo
              </Button>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-24 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-display font-bold mb-4">Everything Your Institution Needs</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                We provide a comprehensive suite of services designed to eliminate administrative overhead and empower educators to focus on what matters most.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Service 1 */}
              <div className="bg-card rounded-2xl p-8 shadow-sm border border-border/50 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Academic Management</h3>
                <p className="text-muted-foreground">End-to-end management of student admissions, attendance tracking, examination grading, and automated report card generation.</p>
              </div>

              {/* Service 2 */}
              <div className="bg-card rounded-2xl p-8 shadow-sm border border-border/50 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 mb-6">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Financial Operations</h3>
                <p className="text-muted-foreground">Streamlined fee collection, automated invoicing, expense tracking, and comprehensive financial reporting for school accountants.</p>
              </div>

              {/* Service 3 */}
              <div className="bg-card rounded-2xl p-8 shadow-sm border border-border/50 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 mb-6">
                  <Building className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Campus Infrastructure</h3>
                <p className="text-muted-foreground">Manage library assets, track transport fleets with live GPS, and oversee hostel room allocations seamlessly.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Who We Are Section */}
        <section id="about" className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl font-display font-bold mb-6">Who We Are</h2>
                <div className="space-y-4 text-lg text-muted-foreground">
                  <p>
                    At <strong>EDUVIA</strong>, we believe that education is the foundation of a better future. However, educational institutions often find themselves bogged down by legacy systems, paperwork, and fragmented communication.
                  </p>
                  <p>
                    We are a team of passionate technologists and educators dedicated to revolutionizing how schools operate. Our mission is to build software that is not only incredibly powerful but also delightfully simple to use.
                  </p>
                  <p>
                    From multi-school SaaS deployments to deep integrations for transport and security, EDUVIA is built to scale with your ambitions. We handle the complexity of school operations so you can focus on shaping the minds of tomorrow.
                  </p>
                </div>
                
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <span className="font-medium">Enterprise Security</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <span className="font-medium">Lightning Fast</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-medium">Role-based Access</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-full bg-gradient-to-tr from-primary/20 to-blue-500/20 absolute -inset-4 blur-3xl -z-10" />
                <img 
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" 
                  alt="Students and technology" 
                  className="rounded-2xl shadow-2xl object-cover"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/50 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-2xl font-display font-bold tracking-tight text-primary">EDUVIA</span>
          </div>
          <p className="mb-6">The definitive operating system for modern educational institutions.</p>
          <div className="flex justify-center gap-6 text-sm">
            <Link href="#" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="#" className="hover:text-foreground">Terms of Service</Link>
            <Link href="#" className="hover:text-foreground">Contact Us</Link>
          </div>
          <p className="mt-8 text-sm">© {new Date().getFullYear()} EDUVIA. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
