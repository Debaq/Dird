import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAdmin } from '@/lib/api/admin-service';

interface AdminLoginProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminLogin({ open, onOpenChange }: AdminLoginProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error(t('admin.login.errors.missingCredentials'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginAdmin({ username, password });

      if (response.success) {
        toast.success(t('admin.login.success'));
        onOpenChange(false);
        navigate('/admin');
      } else {
        toast.error(response.error || t('admin.login.errors.invalidCredentials'));
      }
    } catch (error) {
      toast.error(t('admin.login.errors.loginError'));
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setShowPassword(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Lock className="w-5 h-5" />
            {t('admin.login.title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="admin-username">{t('admin.login.usernameLabel')}</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-smoke-500 dark:text-dark-textSecondary" />
              <Input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="pl-10"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password">{t('admin.login.passwordLabel')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-smoke-500 dark:text-dark-textSecondary" />
              <Input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 pr-10"
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-smoke-500 dark:text-dark-textSecondary hover:text-coal-700 dark:hover:text-dark-text"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              {t('ui.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? t('admin.login.loading') : t('admin.login.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
