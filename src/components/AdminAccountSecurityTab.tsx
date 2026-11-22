import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  Power,
  AlertCircle,
  CheckCircle2,
  X,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { api, AdminManagedUser, AdminUserSession } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';

interface AdminAccountSecurityTabProps {
  adminUser?: AdminUserSession | null;
  onPasswordChanged?: (noticeMessage: string) => void;
}

export function AdminAccountSecurityTab({
  adminUser,
  onPasswordChanged,
}: AdminAccountSecurityTabProps) {
  const isChiefAdmin = adminUser?.roleCode === 'chief_admin';

  // Password change state (available to both Chief Admin & Senior Editor)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Chief Admin user management state
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersFeedback, setUsersFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Create user form state
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState<'senior_editor' | 'chief_admin'>('senior_editor');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Confirmation modal state for user status toggle / delete
  const [confirmAction, setConfirmAction] = useState<{
    kind: 'delete' | 'toggle_status';
    user: AdminManagedUser;
  } | null>(null);
  const [isProcessingUserAction, setIsProcessingUserAction] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!isChiefAdmin) return;
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      const list = await api.getAdminUsers();
      setUsers(list);
    } catch (err: any) {
      setUsersError(err?.message || 'उपयोगकर्ता सूची लोड करने में विफल रहा।');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [isChiefAdmin]);

  useEffect(() => {
    if (isChiefAdmin) {
      loadUsers();
    } else {
      setUsers([]);
    }
  }, [isChiefAdmin, loadUsers]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPassword) return;
    setPasswordFeedback(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'कृपया वर्तमान पासवर्ड, नया पासवर्ड और पुष्टि पासवर्ड भरें।',
      });
      return;
    }

    if (newPassword.length < 14) {
      setPasswordFeedback({
        type: 'error',
        message: 'सुरक्षा मानकों के लिए नया पासवर्ड कम से कम 14 अक्षरों का होना चाहिए।',
      });
      return;
    }

    if (newPassword.length > 256) {
      setPasswordFeedback({
        type: 'error',
        message: 'नया पासवर्ड 256 अक्षरों से अधिक नहीं हो सकता।',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'नया पासवर्ड और पुष्टि पासवर्ड मेल नहीं खा रहे हैं।',
      });
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'नया पासवर्ड वर्तमान पासवर्ड से भिन्न होना चाहिए।',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await api.changeMyPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({
        type: 'success',
        message: result.message,
      });

      if (onPasswordChanged) {
        onPasswordChanged(result.message);
      }
    } catch (err: any) {
      setCurrentPassword('');
      setPasswordFeedback({
        type: 'error',
        message: err?.message || 'पासवर्ड बदलने में त्रुटि हुई।',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isChiefAdmin || isCreatingUser) return;
    setUsersFeedback(null);

    const trimmedUsername = newUsername.trim();
    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(trimmedUsername)) {
      setUsersFeedback({
        type: 'error',
        message: 'यूज़रनेम 3–64 अक्षरों का होना चाहिए (केवल अक्षर, अंक, ., _, - मान्य हैं)।',
      });
      return;
    }

    if (newUserPassword.length < 14 || newUserPassword.length > 256) {
      setUsersFeedback({
        type: 'error',
        message: 'नए खाते का पासवर्ड 14 से 256 अक्षरों के बीच होना चाहिए।',
      });
      return;
    }

    setIsCreatingUser(true);
    try {
      const created = await api.createAdminUser({
        username: trimmedUsername,
        password: newUserPassword,
        roleCode: newRoleCode,
        name: newDisplayName.trim() || undefined,
      });
      setNewUsername('');
      setNewDisplayName('');
      setNewUserPassword('');
      setNewRoleCode('senior_editor');
      await loadUsers();
      setUsersFeedback({
        type: 'success',
        message: `उपयोगकर्ता "${created.username}" (${created.role}) सफलतापूर्वक बनाया गया।`,
      });
    } catch (err: any) {
      setNewUserPassword('');
      setUsersFeedback({
        type: 'error',
        message: err?.message || 'नया उपयोगकर्ता बनाने में विफल रहा।',
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleConfirmUserAction = async () => {
    if (!confirmAction || isProcessingUserAction || !isChiefAdmin) return;
    setIsProcessingUserAction(true);
    setUsersFeedback(null);

    try {
      if (confirmAction.kind === 'delete') {
        await api.deleteAdminUser(confirmAction.user.id);
        await loadUsers();
        setUsersFeedback({
          type: 'success',
          message: `उपयोगकर्ता "${confirmAction.user.username}" को हटा दिया गया और उनके सभी सक्रिय सत्र समाप्त कर दिए गए।`,
        });
      } else {
        const nextActive = !confirmAction.user.isActive;
        const updated = await api.updateAdminUserStatus(confirmAction.user.id, nextActive);
        await loadUsers();
        setUsersFeedback({
          type: 'success',
          message: nextActive
            ? `उपयोगकर्ता "${updated.username}" को पुनः सक्रिय किया गया।`
            : `उपयोगकर्ता "${updated.username}" को निष्क्रिय किया गया और सभी सत्र समाप्त कर दिए गए।`,
        });
      }
      setConfirmAction(null);
    } catch (err: any) {
      setConfirmAction(null);
      setUsersFeedback({
        type: 'error',
        message: err?.message || 'उपयोगकर्ता प्रबंधन कार्रवाई विफल रही।',
      });
    } finally {
      setIsProcessingUserAction(false);
    }
  };

  const activeChiefAdminCount = users.filter(
    (u) => u.isActive && u.roleCode === 'chief_admin'
  ).length;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={
          confirmAction?.kind === 'delete'
            ? 'उपयोगकर्ता हटाने की पुष्टि करें'
            : confirmAction?.user.isActive
            ? 'उपयोगकर्ता निष्क्रिय करने की पुष्टि करें'
            : 'उपयोगकर्ता सक्रिय करने की पुष्टि करें'
        }
        message={
          confirmAction?.kind === 'delete'
            ? `क्या आप "${confirmAction.user.username}" खाते को स्थायी रूप से हटाना चाहते हैं? इसके सभी सक्रिय सत्र तुरंत समाप्त हो जाएंगे।`
            : confirmAction?.user.isActive
            ? `क्या आप "${confirmAction.user.username}" खाते को निष्क्रिय करना चाहते हैं? निष्क्रिय करने पर इस खाते के सभी सत्र तुरंत रद्द हो जाएंगे।`
            : confirmAction
            ? `क्या आप "${confirmAction.user.username}" खाते को पुनः सक्रिय करना चाहते हैं?`
            : ''
        }
        confirmLabel={
          confirmAction?.kind === 'delete'
            ? 'स्थायी रूप से हटाएं'
            : confirmAction?.user.isActive
            ? 'निष्क्रिय करें'
            : 'सक्रिय करें'
        }
        cancelLabel="रद्द करें"
        tone={confirmAction?.kind === 'delete' || confirmAction?.user.isActive ? 'danger' : 'warning'}
        theme="light"
        isProcessing={isProcessingUserAction}
        onConfirm={handleConfirmUserAction}
        onCancel={() => {
          if (!isProcessingUserAction) setConfirmAction(null);
        }}
      />

      {/* Section 1: Password Rotation (All authenticated roles) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 text-red-700 text-xs font-bold uppercase tracking-wider mb-1">
          <KeyRound className="w-4 h-4" />
          <span>खाता सुरक्षा एवं पासवर्ड रोटेशन (Account Security)</span>
        </div>
        <h3 className="font-hindi-brand text-lg font-bold text-zinc-950">
          अपना एडमिन पासवर्ड बदलें
        </h3>
        <p className="text-xs text-zinc-500 mt-1 mb-5 leading-relaxed">
          पासवर्ड बदलने के बाद सुरक्षा हेतु आपके सभी सक्रिय सत्र समाप्त कर दिए जाएंगे और आपको नए पासवर्ड से पुनः लॉगिन करना होगा।
        </p>

        {passwordFeedback && (
          <div
            role={passwordFeedback.type === 'error' ? 'alert' : 'status'}
            className={`mb-4 px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
              passwordFeedback.type === 'error'
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {passwordFeedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              )}
              <span>{passwordFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setPasswordFeedback(null)}
              aria-label="Dismiss password feedback"
              className="p-1 rounded hover:bg-black/5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
          <div>
            <label
              htmlFor="akp-current-password"
              className="block text-xs font-bold text-zinc-700 mb-1"
            >
              वर्तमान पासवर्ड <span className="text-rose-600">*</span>
            </label>
            <input
              id="akp-current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="वर्तमान पासवर्ड दर्ज करें"
              className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:outline-hidden focus:border-zinc-800"
            />
          </div>

          <div>
            <label
              htmlFor="akp-new-password"
              className="block text-xs font-bold text-zinc-700 mb-1"
            >
              नया पासवर्ड (न्यूनतम 14 अक्षर) <span className="text-rose-600">*</span>
            </label>
            <input
              id="akp-new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={14}
              maxLength={256}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="कम से कम 14 अक्षर"
              className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:outline-hidden focus:border-zinc-800"
            />
          </div>

          <div>
            <label
              htmlFor="akp-confirm-password"
              className="block text-xs font-bold text-zinc-700 mb-1"
            >
              नया पासवर्ड पुनः दर्ज करें <span className="text-rose-600">*</span>
            </label>
            <input
              id="akp-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={14}
              maxLength={256}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="पुष्टि पासवर्ड दर्ज करें"
              className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:outline-hidden focus:border-zinc-800"
            />
          </div>

          <div className="md:col-span-3 flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              <span>प्रत्येक उपयोगकर्ता के लिए अद्वितीय और मजबूत पासफ़्रेज़ (14+ अक्षर) का उपयोग करें।</span>
            </span>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{isChangingPassword ? 'सुरक्षित अपडेट हो रहा है...' : 'पासवर्ड अपडेट करें'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Admin User Management (Chief Admin ONLY) */}
      {isChiefAdmin && (
        <div
          data-testid="chief-admin-user-management"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Create Admin/Editor Form */}
          <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-wider mb-1">
              <UserPlus className="w-4 h-4" />
              <span>नया खाता बनाएं (Chief Admin Only)</span>
            </div>
            <h4 className="font-hindi-brand text-base font-bold text-zinc-950 mb-1">
              एडमिन / संपादक खाता जोड़ें
            </h4>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              नए उपयोगकर्ता के लिए अद्वितीय यूज़रनेम और कम से कम 14 अक्षरों का प्रारंभिक पासवर्ड सेट करें।
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  यूज़रनेम (Username) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="उदा. desk_editor_1"
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  प्रदर्शित नाम (Display Name)
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="उदा. अनामिका वर्मा"
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  भूमिका (Role) <span className="text-rose-600">*</span>
                </label>
                <select
                  aria-label="Assign role"
                  value={newRoleCode}
                  onChange={(e) =>
                    setNewRoleCode(e.target.value as 'senior_editor' | 'chief_admin')
                  }
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-800"
                >
                  <option value="senior_editor">वरिष्ठ संपादक (Senior Editor)</option>
                  <option value="chief_admin">मुख्य व्यवस्थापक (Chief Admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  प्रारंभिक पासवर्ड (14+ अक्षर) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={14}
                  maxLength={256}
                  autoComplete="new-password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="कम से कम 14 अक्षर"
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingUser}
                className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isCreatingUser ? 'खाता बनाया जा रहा है...' : 'उपयोगकर्ता जोड़ें'}</span>
              </button>
            </form>
          </div>

          {/* Admin Users Table */}
          <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-700" />
                <h4 className="font-hindi-brand text-base font-bold text-zinc-950">
                  अधिकृत व्यवस्थापक एवं संपादक सूची ({users.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={loadUsers}
                disabled={isLoadingUsers}
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                <span>रिफ्रेश</span>
              </button>
            </div>

            {usersFeedback && (
              <div
                role={usersFeedback.type === 'error' ? 'alert' : 'status'}
                className={`mb-4 px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
                  usersFeedback.type === 'error'
                    ? 'bg-red-50 border-red-300 text-red-900'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {usersFeedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                  )}
                  <span>{usersFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUsersFeedback(null)}
                  aria-label="Dismiss user feedback"
                  className="p-1 rounded hover:bg-black/5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {usersError && (
              <div
                role="alert"
                className="mb-4 px-4 py-3 rounded-xl border bg-red-50 border-red-300 text-red-900 text-xs font-bold"
              >
                {usersError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Display Name</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-800">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-zinc-400">
                        {isLoadingUsers ? 'उपयोगकर्ता लोड हो रहे हैं...' : 'कोई उपयोगकर्ता रिकॉर्ड नहीं मिला।'}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSelf =
                        (adminUser?.id && u.id === adminUser.id) ||
                        u.username.toLowerCase() === adminUser?.username?.toLowerCase();
                      const isLastActiveChief =
                        u.isActive && u.roleCode === 'chief_admin' && activeChiefAdminCount <= 1;
                      const cannotDeactivateOrDelete = isSelf || isLastActiveChief;

                      return (
                        <tr key={u.id} className="hover:bg-zinc-50/70">
                          <td className="py-3 px-3 font-mono font-bold text-zinc-900">
                            {u.username}
                            {isSelf && (
                              <span className="ml-1.5 text-[10px] font-sans bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                आप
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">{u.name}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                u.roleCode === 'chief_admin'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-zinc-100 text-zinc-800'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                u.isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-zinc-200 text-zinc-700'
                              }`}
                            >
                              {u.isActive ? 'सक्रिय (Active)' : 'निष्क्रिय (Inactive)'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={u.isActive ? cannotDeactivateOrDelete : false}
                                onClick={() =>
                                  setConfirmAction({ kind: 'toggle_status', user: u })
                                }
                                title={
                                  u.isActive
                                    ? isSelf
                                      ? 'अपना स्वयं का सक्रिय खाता निष्क्रिय नहीं किया जा सकता'
                                      : isLastActiveChief
                                      ? 'अंतिम सक्रिय Chief Admin को निष्क्रिय नहीं किया जा सकता'
                                      : 'खाता निष्क्रिय करें'
                                    : 'खाता सक्रिय करें'
                                }
                                className="p-1.5 rounded text-zinc-600 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <Power className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={cannotDeactivateOrDelete}
                                onClick={() => setConfirmAction({ kind: 'delete', user: u })}
                                title={
                                  isSelf
                                    ? 'अपना स्वयं का खाता हटाया नहीं जा सकता'
                                    : isLastActiveChief
                                    ? 'अंतिम सक्रिय Chief Admin खाता हटाया नहीं जा सकता'
                                    : 'खाता हटाएं'
                                }
                                className="p-1.5 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
