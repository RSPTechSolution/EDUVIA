'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res: any = await apiClient.post('/auth/login', {
        email: email,
        password: password,
      });

      if (res.data?.tokens?.access_token) {
        const token = res.data.tokens.access_token;
        localStorage.setItem('access_token', token);
        router.push('/dashboard');
      } else {
        setError('Failed to login. Please try again.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error?.message || 'Invalid credentials');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center mb-6">
          <img src="/logo_transparent.png" alt="EDUVIA Logo" className="h-24 sm:h-32 w-auto object-contain mb-2" />
        </div>
        <h2 className="mb-6 text-sm font-medium text-center text-muted-foreground">Sign in to your account</h2>
        {error && <div className="mb-4 text-red-500 text-sm text-center">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input 
              type="email" 
              required
              className="w-full rounded-md border p-2 bg-background" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@geps.edu"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input 
              type="password" 
              required
              className="w-full rounded-md border p-2 bg-background" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
            />
          </div>
          <Button type="submit" className="w-full">Sign In</Button>
        </form>
      </div>
    </div>
  );
}
