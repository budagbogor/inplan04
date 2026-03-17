import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { RefreshCcw, UserPlus } from 'lucide-react';

type ManagedUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function UserManagementPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 8 && !submitting;
  }, [email, password, submitting]);

  const loadUsers = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-management', {
        body: { action: 'list' },
      });
      if (error) throw error;
      const list = (data?.users ?? []) as ManagedUser[];
      setUsers(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat user';
      toast.error(message);
    } finally {
      setLoadingUsers(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers(false);
  }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-management', {
        body: { action: 'create', email: email.trim(), password },
      });
      if (error) throw error;
      if (!data?.user?.id) {
        throw new Error('User berhasil dibuat, tetapi response tidak lengkap');
      }
      toast.success('User baru berhasil dibuat');
      setEmail('');
      setPassword('');
      await loadUsers(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal membuat user';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="User Management"
        description="Tambah user baru (khusus admin). Semua user dapat menggunakan seluruh fitur aplikasi termasuk upload data."
      >
        <Button
          onClick={() => loadUsers(true)}
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={refreshing}
        >
          <RefreshCcw className={refreshing ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
          {refreshing ? 'Memuat...' : 'Refresh'}
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-accent" />
            Tambah User Baru
          </CardTitle>
          <CardDescription>Gunakan password minimal 8 karakter.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail">Email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  autoComplete="off"
                  placeholder="user@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? 'Memproses...' : 'Buat User'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Daftar User</CardTitle>
              <CardDescription>Data ini diambil dari Supabase Auth.</CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">
              {users.length} user
            </Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {loadingUsers ? (
            <div className="text-sm text-muted-foreground">Memuat user...</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-muted-foreground">Belum ada user.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] sm:text-xs">Email</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Created</TableHead>
                    <TableHead className="text-[10px] sm:text-xs">Last Sign In</TableHead>
                    <TableHead className="text-right text-[10px] sm:text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const confirmed = Boolean(u.email_confirmed_at);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="text-xs sm:text-sm font-medium">
                          {u.email ?? '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(u.created_at)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(u.last_sign_in_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          {confirmed ? (
                            <Badge className="text-[10px]" variant="secondary">
                              Confirmed
                            </Badge>
                          ) : (
                            <Badge className="text-[10px]" variant="outline">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

