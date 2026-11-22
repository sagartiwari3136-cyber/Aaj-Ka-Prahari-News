import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, Edit, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { EditorAnchor } from '../types';
import { api } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400';

export function CmsEditorsTab() {
  const [editors, setEditors] = useState<EditorAnchor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditorAnchor | null>(null);

  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formShowName, setFormShowName] = useState('विशेष बुलेटिन');
  const [formExperience, setFormExperience] = useState('10+ वर्ष अनुभव');
  const [formTwitter, setFormTwitter] = useState('@akpnews');
  const [formImageUrl, setFormImageUrl] = useState(DEFAULT_AVATAR);
  const [formBio, setFormBio] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditorAnchor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadEditors = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getEditors();
      setEditors(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'संपादकीय मंडल सूची लोड करने में त्रुटि हुई।',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEditors();
  }, [loadEditors]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName('');
    setFormRole('');
    setFormShowName('विशेष बुलेटिन');
    setFormExperience('10+ वर्ष अनुभव');
    setFormTwitter('@akpnews');
    setFormImageUrl(DEFAULT_AVATAR);
    setFormBio('वरिष्ठ पत्रकार एवं संपादकीय विश्लेषक।');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: EditorAnchor) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormRole(item.role);
    setFormShowName(item.showName || 'विशेष बुलेटिन');
    setFormExperience(item.experience || '10+ वर्ष अनुभव');
    setFormTwitter(item.twitter || '@akpnews');
    setFormImageUrl(item.imageUrl || DEFAULT_AVATAR);
    setFormBio(item.bio || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formName.trim() || !formRole.trim()) {
      setFormError('कृपया संपादक का नाम और पद दोनों भरें।');
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const payload: Partial<EditorAnchor> = {
        name: formName.trim(),
        role: formRole.trim(),
        showName: formShowName.trim() || 'विशेष बुलेटिन',
        experience: formExperience.trim() || '10+ वर्ष अनुभव',
        twitter: formTwitter.trim() || '@akpnews',
        imageUrl: formImageUrl.trim(),
        bio: formBio.trim() || 'वरिष्ठ पत्रकार एवं संपादकीय विश्लेषक।',
      };

      if (editingItem) {
        await api.updateEditor(editingItem.id, payload);
        setFeedback({ type: 'success', message: 'संपादक/एंकर प्रोफाइल सफलतापूर्वक अपडेट की गई।' });
      } else {
        await api.createEditor(payload);
        setFeedback({ type: 'success', message: 'नया संपादक/एंकर सफलतापूर्वक जोड़ा गया।' });
      }

      setIsModalOpen(false);
      await loadEditors();
    } catch (err: any) {
      setFormError(err?.message || 'प्रोफाइल सहेजने में विफल रहा।');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.deleteEditor(deleteTarget.id);
      setDeleteTarget(null);
      setFeedback({ type: 'success', message: 'संपादक/एंकर प्रोफाइल सफलतापूर्वक हटाई गई।' });
      await loadEditors();
    } catch (err: any) {
      setDeleteTarget(null);
      setFeedback({ type: 'error', message: err?.message || 'प्रोफाइल हटाने में विफल रहा।' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="संपादक प्रोफाइल हटाने की पुष्टि"
        message={
          deleteTarget
            ? `क्या आप "${deleteTarget.name}" को संपादकीय मंडल से स्थायी रूप से हटाना चाहते हैं?`
            : ''
        }
        confirmLabel="हाँ, हटाएं"
        cancelLabel="रद्द करें"
        tone="danger"
        theme="light"
        isProcessing={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
      />

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mx-4 mt-4 px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss editor notification"
            className="p-1 rounded hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-red-700" />
          <h3 className="font-hindi-brand font-bold text-sm text-zinc-900">
            संपादकीय मंडल एवं एंकर्स ({editors.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="bg-red-700 hover:bg-red-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-hindi-brand font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>नया संपादक/एंकर जोड़ें</span>
        </button>
      </div>

      {/* Add / Edit Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-hindi-brand font-bold text-lg text-zinc-900 mb-4 pb-2 border-b border-zinc-200">
              {editingItem ? 'संपादक प्रोफाइल संपादित करें' : 'नया संपादक / एंकर जोड़ें'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    पूरा नाम (Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="जैसे: संदीप चौधरी"
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand focus:outline-hidden focus:ring-1 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    पद / भूमिका (Role) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="जैसे: वरिष्ठ एंकर व राजनीतिक विश्लेषक"
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand focus:outline-hidden focus:ring-1 focus:ring-red-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    प्रमुख शो (Show)
                  </label>
                  <input
                    type="text"
                    value={formShowName}
                    onChange={(e) => setFormShowName(e.target.value)}
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    अनुभव (Experience)
                  </label>
                  <input
                    type="text"
                    value={formExperience}
                    onChange={(e) => setFormExperience(e.target.value)}
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    हैंडल (Handle)
                  </label>
                  <input
                    type="text"
                    value={formTwitter}
                    onChange={(e) => setFormTwitter(e.target.value)}
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                  प्रोफाइल फोटो URL (https://...)
                </label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                  संक्षिप्त परिचय (Bio)
                </label>
                <textarea
                  rows={3}
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="पत्रकारिता अनुभव व विशेषज्ञता का विवरण..."
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand focus:outline-hidden focus:ring-1 focus:ring-red-600"
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-hindi-brand font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white px-5 py-2 text-xs font-hindi-brand font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {isSaving ? 'सहेजा जा रहा है...' : 'सहेजें व अपडेट करें'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editors List */}
      <div className="divide-y divide-zinc-200">
        {isLoading && editors.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs font-hindi-brand font-bold">
            संपादकीय मंडल लोड हो रहा है...
          </div>
        ) : editors.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 font-hindi-brand">
            अभी कोई संपादक या एंकर प्रोफाइल उपलब्ध नहीं है। ऊपर दिए गए बटन से नई प्रोफाइल जोड़ें।
          </div>
        ) : (
          editors.map((item) => (
            <div
              key={item.id}
              className="p-4 flex items-start justify-between gap-4 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-14 h-14 rounded-xl object-cover object-top shrink-0 border border-zinc-200"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded font-hindi-brand">
                      {item.role}
                    </span>
                    {item.showName && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded font-hindi-brand">
                        {item.showName}
                      </span>
                    )}
                    {item.experience && (
                      <span className="text-[10px] text-zinc-500 font-hindi-brand">
                        {item.experience}
                      </span>
                    )}
                  </div>
                  <h4 className="font-hindi-brand font-bold text-sm text-zinc-900">
                    {item.name}
                  </h4>
                  {item.bio && (
                    <p className="text-xs text-zinc-500 font-hindi-brand line-clamp-1 mt-0.5">
                      {item.bio}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(item)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                  title="संपादित करें"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  className="p-1.5 text-zinc-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="हटाएं"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
