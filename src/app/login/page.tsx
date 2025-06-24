'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Image from 'next/image';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: undefined,
          },
        });

        if (error) {
          setMessage(error.message);
        } else {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            setMessage('Account created but could not sign in automatically. Please try signing in.');
            setIsSignUp(false);
          } else {
            setMessage('Account created and signed in successfully!');
            router.push('/dashboard');
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
        } else {
          router.push('/dashboard');
        }
      }
    } catch {
      setMessage('An unexpected error occurred')
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sg-off-white">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-sm border border-sg-light-grey">
        <div className="text-center">
          {/* Social Garden Logo */}
          <div className="mb-6">
            <Image
              src="/SocialGarden.svg"
              alt="Social Garden"
              width={200}
              height={40}
              className="mx-auto"
              priority
            />
          </div>
          <h1 className="text-sg-deep-green font-extrabold text-2xl mb-2">
            SOW Generator
          </h1>
          <h2 className="text-sg-charcoal font-bold text-xl">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="ui-label mt-2">
            Internal tool for Social Garden team
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="ui-label">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="mt-1 border-sg-light-grey focus:border-sg-deep-green focus:ring-sg-deep-green/20"
              />
            </div>
            <div>
              <Label htmlFor="password" className="ui-label">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 border-sg-light-grey focus:border-sg-deep-green focus:ring-sg-deep-green/20"
              />
            </div>
          </div>

          {message && (
            <div className={`text-sm p-3 rounded-md ${
              message.includes('error') || message.includes('Invalid') || message.includes('could not') 
                ? 'bg-red-50 text-red-600 border border-red-200' 
                : 'bg-sg-light-teal text-sg-deep-green border border-sg-teal'
            }`}>
              {message}
            </div>
          )}

          <div className="space-y-4">
            <Button
              type="submit"
              className="w-full bg-sg-deep-green hover:bg-sg-deep-green/90 text-white font-bold"
              disabled={loading}
            >
              {loading ? 'Loading...' : (isSignUp ? 'Sign up' : 'Sign in')}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full border-sg-teal text-sg-deep-green hover:bg-sg-light-teal font-medium"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage('');
              }}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 