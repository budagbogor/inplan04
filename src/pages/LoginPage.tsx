import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import logoImg from '@/assets/logo.png';

type LocationState = { from?: { pathname: string } } | null;

export default function LoginPage() {
  const { user, loading, signInWithPassword } = useAuth();
  const location = useLocation();

  const fromPathname = useMemo(() => {
    const state = location.state as LocationState;
    return state?.from?.pathname ?? '/';
  }, [location.state]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={fromPathname} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      toast.success('Login berhasil');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal login';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full futuristic-surface relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
      <div className="relative z-10 w-full max-w-md">
        <Card className="shadow-card border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/90">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 border border-border/60 flex items-center justify-center overflow-hidden">
                <img src={logoImg} alt="Logo" className="h-9 w-9 object-contain" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg leading-tight">Mobeng Inventory Planner</CardTitle>
                <CardDescription className="leading-snug">
                  Masuk untuk mengakses dashboard, analisa, dan pengaturan.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting || loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting || loading}
                  required
                />
              </div>

              <Button
                type="submit"
                className={cn("w-full", submitting && "opacity-90")}
                disabled={submitting || loading}
              >
                {submitting ? 'Memproses...' : 'Masuk'}
              </Button>

              <div className="text-xs text-muted-foreground leading-relaxed">
                Data upload besar tersimpan lokal di perangkat ini (IndexedDB). Pastikan menggunakan perangkat yang sama untuk melihat data upload yang sama.
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
