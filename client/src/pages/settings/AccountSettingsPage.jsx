import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { authService } from '../../services/authService';

const AccountSettingsPage = () => {
  const navigate = useNavigate();
  const { logoutAll } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdErr('');
    setPwdMsg('');
    setPwdSaving(true);
    try {
      await authService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdMsg('Password updated.');
      showToast('Password updated');
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message
        || err.response?.data?.message
        || err.message
        || 'Could not update password';
      setPwdErr(msg);
    } finally {
      setPwdSaving(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Sign out on all devices? You will need to log in again on each device.')) return;
    await logoutAll();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Settings</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Manage your password and active sessions.
        </p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card space-y-5 p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
          <KeyRound size={18} className="text-brand-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">Security</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Use a strong password with at least one uppercase letter and one number.
            {' '}
            <Link to="/forgot-password" className="font-medium text-brand-400 hover:underline">
              Forgot password?
            </Link>
          </p>
          <div>
            <label htmlFor="pwd-current" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Current password
            </label>
            <input
              id="pwd-current"
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setPwdErr(''); setPwdMsg(''); }}
              className="input-base"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="pwd-new" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              New password
            </label>
            <input
              id="pwd-new"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPwdErr(''); setPwdMsg(''); }}
              className="input-base"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="pwd-confirm" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Confirm new password
            </label>
            <input
              id="pwd-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPwdErr(''); setPwdMsg(''); }}
              className="input-base"
              autoComplete="new-password"
            />
          </div>
          {pwdErr && <p className="text-sm text-red-400" role="alert">{pwdErr}</p>}
          {pwdMsg && !pwdErr && <p className="text-sm text-green-400">{pwdMsg}</p>}
          <button
            type="submit"
            disabled={pwdSaving}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-brand-500/50 disabled:opacity-60"
          >
            {pwdSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            Update password
          </button>
        </form>

        <div className="border-t border-[var(--border-color)] pt-5">
          <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">Sessions</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Sign out everywhere if you suspect someone else accessed your account.
          </p>
          <button
            type="button"
            onClick={handleLogoutAll}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-500/30 px-5 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            Log out all devices
          </button>
        </div>
      </motion.section>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            role="status"
            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-solid)] px-4 py-2 text-sm text-[var(--text-primary)] shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountSettingsPage;
