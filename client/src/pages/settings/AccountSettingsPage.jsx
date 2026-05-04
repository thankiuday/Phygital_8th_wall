import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  KeyRound,
  Loader2,
  Shield,
  Calendar,
  Clock,
  BarChart3,
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { authService } from '../../services/authService';

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
};

const AccountSettingsPage = () => {
  const navigate = useNavigate();
  const { user: storeUser, updateUser, logoutAll } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [remoteUser, setRemoteUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  const [toast, setToast] = useState('');
  const [avatarBroken, setAvatarBroken] = useState(false);

  const initials = useMemo(() => {
    const n = (name.trim() || remoteUser?.name || storeUser?.name || 'U').trim();
    return n.split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2) || 'U';
  }, [name, remoteUser, storeUser]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError('');
      try {
        const data = await authService.getMe({ stats: true });
        if (cancelled) return;
        setRemoteUser(data.user);
        setStats(data.stats ?? null);
        setName(data.user.name || '');
        setAvatarUrl(data.user.avatar || '');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.response?.data?.message || err.message || 'Could not load account.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileErr('');
    setProfileMsg('');
    if (!remoteUser) return;

    const payload = {};
    const trimmedName = name.trim();
    if (trimmedName !== remoteUser.name) payload.name = trimmedName;

    const av = avatarUrl.trim();
    const nextAvatar = av === '' ? '' : av;
    const prevAvatar = remoteUser.avatar || '';
    if (nextAvatar !== prevAvatar) {
      payload.avatar = nextAvatar === '' ? '' : nextAvatar;
    }

    if (Object.keys(payload).length === 0) {
      setProfileMsg('No changes to save.');
      return;
    }

    setProfileSaving(true);
    try {
      const { user: updated } = await authService.updateProfile(payload);
      setRemoteUser(updated);
      updateUser(updated);
      setName(updated.name);
      setAvatarUrl(updated.avatar || '');
      setProfileMsg('Profile saved.');
      showToast('Profile saved');
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message
        || err.response?.data?.message
        || err.message
        || 'Save failed';
      setProfileErr(msg);
    } finally {
      setProfileSaving(false);
    }
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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" aria-hidden />
        <p className="text-sm text-[var(--text-muted)]">Loading account…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        {loadError}
      </div>
    );
  }

  const displayUser = remoteUser || storeUser;
  if (!displayUser) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Account</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Profile and security settings for your workspace.
        </p>
      </div>

      {/* Profile */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card space-y-5 p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
          <User size={18} className="text-brand-400" />
          <h3 className="font-semibold text-[var(--text-primary)]">Profile</h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-2)] text-lg font-bold text-brand-400">
                {avatarUrl.trim() && !avatarBroken ? (
                  <img
                    src={avatarUrl.trim()}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  initials
                )}
              </div>
              <span className="text-xs text-[var(--text-muted)]">Preview</span>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <label htmlFor="acct-name" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Display name
                </label>
                <input
                  id="acct-name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setProfileErr(''); setProfileMsg(''); }}
                  maxLength={60}
                  className="input-base"
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="acct-avatar" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Avatar image URL (optional)
                </label>
                <input
                  id="acct-avatar"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => { setAvatarUrl(e.target.value); setProfileErr(''); setProfileMsg(''); }}
                  placeholder="https://…"
                  className="input-base"
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">Clear the field to remove your avatar.</p>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Email</span>
                <p className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-primary)]">
                  {displayUser.email}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Email cannot be changed here.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 capitalize ${
              displayUser.role === 'admin'
                ? 'border-brand-500/30 bg-brand-500/10 text-brand-400'
                : 'border-[var(--border-color)] bg-[var(--surface-2)]'
            }`}>
              <Shield size={12} />
              {displayUser.role || 'user'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              Joined {fmtDate(displayUser.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              Last sign-in {fmtDate(displayUser.lastLoginAt)}
            </span>
          </div>

          {stats && (
            <div className="flex flex-wrap gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                <BarChart3 size={14} className="text-brand-400" />
                <strong className="text-[var(--text-primary)]">{stats.campaignCount}</strong> campaigns
              </span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">{stats.activeCampaignCount}</strong> active
              </span>
            </div>
          )}

          {profileErr && (
            <p className="text-sm text-red-400" role="alert">{profileErr}</p>
          )}
          {profileMsg && !profileErr && (
            <p className="text-sm text-green-400">{profileMsg}</p>
          )}

          <button
            type="submit"
            disabled={profileSaving}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-500 disabled:opacity-60"
          >
            {profileSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            Save profile
          </button>
        </form>
      </motion.section>

      {/* Security */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
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
