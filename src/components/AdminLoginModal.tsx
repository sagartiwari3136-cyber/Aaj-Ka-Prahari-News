import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  X,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { api, AdminUserSession } from '../services/api';

interface AdminLoginModalProps {
  isOpen?: boolean;
  isPage?: boolean;
  onClose?: () => void;
  noticeMessage?: string | null;
  onLoginSuccess: (adminData: { token: string; user: AdminUserSession }) => void;
}

export function AdminLoginModal({
  isOpen = true,
  isPage = false,
  onClose,
  noticeMessage,
  onLoginSuccess,
}: AdminLoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen && !isPage) return;
    setError('');
    setIsCheckingStatus(true);
    api
      .getBootstrapStatus()
      .then((res) => {
        setSetupRequired(res.setupRequired);
      })
      .catch(() => {
        setSetupRequired(false);
      })
      .finally(() => {
        setIsCheckingStatus(false);
      });
  }, [isOpen, isPage]);

  if (!isOpen && !isPage) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('कृपया दोनों उपयोगकर्ता नाम और पासवर्ड दर्ज करें।');
      return;
    }

    if (setupRequired) {
      if (password.length < 8) {
        setError('पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।');
        return;
      }
      if (password !== confirmPassword) {
        setError('दोनों पासवर्ड मेल नहीं खा रहे हैं।');
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = setupRequired
        ? await api.bootstrapAdmin({
            username: username.trim(),
            password,
            name: displayName.trim() || undefined,
          })
        : await api.adminLogin({
            username: username.trim(),
            password,
          });

      onLoginSuccess(res);
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setDisplayName('');
    } catch (err: any) {
      setError(err.message || 'लॉगिन विफल रहा। कृपया क्रेडेंशियल्स की जांच करें।');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={
        isPage
          ? 'min-h-screen bg-gradient-to-br from-[#0F1115] via-[#191517] to-[#0B0D10] flex items-center justify-center p-4 animate-in fade-in duration-150'
          : 'fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150'
      }
    >
      <div className="bg-[#FAF9F5] border border-zinc-300 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-hindi-brand">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#181A1E] via-[#211214] to-[#181A1E] text-white p-5 border-b border-red-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/90 flex items-center justify-center text-white border border-amber-400/40 shadow-xs">
              {setupRequired ? (
                <ShieldCheck className="w-5 h-5 text-amber-300" />
              ) : (
                <Lock className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>
                  {setupRequired ? 'प्रारंभिक व्यवस्थापक स्थापना' : 'सुरक्षित संपादकीय प्रवेश'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {setupRequired ? 'मुख्य एडमिन खाता बनाएं' : 'न्यूज़रूम CMS एडमिन लॉगिन'}
              </h3>
            </div>
          </div>

          {!isPage && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="बंद करें"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Form Body */}
        <div className="p-6">
          {noticeMessage && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{noticeMessage}</span>
            </div>
          )}

          <p className="text-xs text-zinc-600 mb-5 leading-relaxed">
            {setupRequired
              ? 'अभी कोई मुख्य व्यवस्थापक खाता स्थापित नहीं है। कृपया पहली बार के लिए सुरक्षित मुख्य व्यवस्थापक (Chief Admin) क्रेडेंशियल सेट करें।'
              : 'यह अनुभाग केवल अधिकृत संपादकीय टीम एवं व्यवस्थापकों के लिए आरक्षित है। सार्वजनिक वेबसाइट पर कोई संपादन नियंत्रण उपलब्ध नहीं है।'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {setupRequired && (
              <div>
                <label className="block text-xs font-bold text-zinc-800 mb-1">
                  प्रदर्शित नाम (Display Name)
                </label>
                <input
                  type="text"
                  placeholder="उदा. राजेश शर्मा (मुख्य संपादक)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-hidden focus:border-red-600 focus:ring-1 focus:ring-red-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1">
                उपयोगकर्ता नाम (Username / ID)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="अधिकृत यूज़रनेम दर्ज करें"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-hidden focus:border-red-600 focus:ring-1 focus:ring-red-600 font-sans"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-800">
                  पासवर्ड (Password)
                </label>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoComplete={setupRequired ? 'new-password' : 'current-password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-hidden focus:border-red-600 focus:ring-1 focus:ring-red-600 font-sans"
                />
              </div>
            </div>

            {setupRequired && (
              <div>
                <label className="block text-xs font-bold text-zinc-800 mb-1">
                  पासवर्ड की पुष्टि करें (Confirm Password)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="कम से कम 8 अक्षर"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-hidden focus:border-red-600 focus:ring-1 focus:ring-red-600 font-sans"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isCheckingStatus || isLoading || !username || !password}
              className="w-full py-3 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>
                {isLoading
                  ? 'सत्यापित किया जा रहा है...'
                  : setupRequired
                  ? 'मुख्य एडमिन खाता स्थापित करें'
                  : 'न्यूज़रूम में प्रवेश करें'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
