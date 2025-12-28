import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeAdminPassword } from '@/lib/api/admin-service';
import { toast } from 'sonner';

export function ChangePasswordForm() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('admin.changePassword.errors.requiredFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('admin.changePassword.errors.passwordMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t('admin.changePassword.errors.passwordLength'));
      return;
    }

    if (currentPassword === newPassword) {
      toast.error(t('admin.changePassword.errors.passwordSame'));
      return;
    }

    setIsChanging(true);

    try {
      const result = await changeAdminPassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (result.success) {
        toast.success(t('admin.changePassword.success'));
        // Redirect to login after short delay
        setTimeout(() => {
          navigate('/settings');
        }, 1500);
      } else {
        toast.error(result.error || t('admin.changePassword.errors.changeError'));
        setIsChanging(false);
      }
    } catch (error) {
      toast.error(t('admin.changePassword.errors.changeError'));
      console.error(error);
      setIsChanging(false);
    }
  };

  const handleReset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <Card className="p-6 dark:bg-dark-surface dark:border-coal-700 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
          <Lock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-coal-800 dark:text-dark-text">
            {t('admin.changePassword.title')}
          </h2>
          <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
            {t('admin.changePassword.description')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div className="space-y-2">
          <Label htmlFor="current-password">{t('admin.changePassword.currentPasswordLabel')}</Label>
          <div className="relative">
            <Input
              id="current-password"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('admin.changePassword.currentPasswordPlaceholder')}
              disabled={isChanging}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-smoke-600 dark:text-dark-textSecondary hover:text-coal-800 dark:hover:text-dark-text transition-colors"
              tabIndex={-1}
            >
              {showCurrentPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-2">
          <Label htmlFor="new-password">{t('admin.changePassword.newPasswordLabel')}</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('admin.changePassword.newPasswordPlaceholder')}
              disabled={isChanging}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-smoke-600 dark:text-dark-textSecondary hover:text-coal-800 dark:hover:text-dark-text transition-colors"
              tabIndex={-1}
            >
              {showNewPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {newPassword && newPassword.length < 8 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('admin.changePassword.passwordLengthMessage')}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t('admin.changePassword.confirmPasswordLabel')}</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('admin.changePassword.confirmPasswordPlaceholder')}
              disabled={isChanging}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-smoke-600 dark:text-dark-textSecondary hover:text-coal-800 dark:hover:text-dark-text transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {t('admin.changePassword.passwordMismatchMessage')}
            </p>
          )}
        </div>

        {/* Security Note */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>{t('admin.changePassword.securityNoteTitle')}:</strong> {t('admin.changePassword.securityNoteText')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isChanging}
            className="flex-1"
          >
            {t('admin.changePassword.resetButton')}
          </Button>
          <Button
            type="submit"
            disabled={
              isChanging ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword ||
              newPassword !== confirmPassword ||
              newPassword.length < 8
            }
            className="flex-1"
          >
            {isChanging ? t('admin.changePassword.updating') : t('admin.changePassword.submitButton')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
