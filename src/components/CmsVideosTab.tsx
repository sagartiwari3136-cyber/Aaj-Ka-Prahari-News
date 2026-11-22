import React, { useState, useEffect, useCallback } from 'react';
import { Film, Plus, Trash2, Edit, CheckCircle2, AlertCircle, X, Play } from 'lucide-react';
import { VideoNewsItem } from '../types';
import { api } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';

const DEFAULT_THUMBNAIL =
  'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&q=80&w=800';
const DEFAULT_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

export function CmsVideosTab() {
  const [videos, setVideos] = useState<VideoNewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VideoNewsItem | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('विशेष बुलेटिन');
  const [formAnchor, setFormAnchor] = useState('प्रहरी एंकर');
  const [formDuration, setFormDuration] = useState('05:00');
  const [formTag, setFormTag] = useState('वीडियो विशेष');
  const [formThumbnailUrl, setFormThumbnailUrl] = useState(DEFAULT_THUMBNAIL);
  const [formVideoUrl, setFormVideoUrl] = useState(DEFAULT_VIDEO_URL);
  const [formIsLive, setFormIsLive] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoNewsItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getVideos();
      setVideos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'वीडियो बुलेटिन सूची लोड करने में त्रुटि हुई।',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('विशेष बुलेटिन');
    setFormAnchor('प्रहरी एंकर');
    setFormDuration('05:00');
    setFormTag('वीडियो विशेष');
    setFormThumbnailUrl(DEFAULT_THUMBNAIL);
    setFormVideoUrl(DEFAULT_VIDEO_URL);
    setFormIsLive(false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: VideoNewsItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDescription(item.description || '');
    setFormCategory(item.category || 'विशेष बुलेटिन');
    setFormAnchor(item.anchor || 'प्रहरी एंकर');
    setFormDuration(item.duration || '05:00');
    setFormTag(item.tag || 'वीडियो विशेष');
    setFormThumbnailUrl(item.thumbnailUrl || DEFAULT_THUMBNAIL);
    setFormVideoUrl(item.videoUrl || DEFAULT_VIDEO_URL);
    setFormIsLive(Boolean(item.isLive));
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formTitle.trim() || !formDescription.trim()) {
      setFormError('कृपया वीडियो शीर्षक और विवरण दोनों भरें।');
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      const payload: Partial<VideoNewsItem> = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory.trim() || 'विशेष बुलेटिन',
        anchor: formAnchor.trim() || 'प्रहरी एंकर',
        duration: formDuration.trim() || '05:00',
        tag: formTag.trim() || 'वीडियो विशेष',
        thumbnailUrl: formThumbnailUrl.trim(),
        videoUrl: formVideoUrl.trim(),
        isLive: formIsLive,
      };

      if (editingItem) {
        await api.updateVideo(editingItem.id, payload);
        setFeedback({ type: 'success', message: 'वीडियो बुलेटिन सफलतापूर्वक अपडेट किया गया।' });
      } else {
        await api.createVideo(payload);
        setFeedback({ type: 'success', message: 'नया वीडियो बुलेटिन सफलतापूर्वक जोड़ा गया।' });
      }

      setIsModalOpen(false);
      await loadVideos();
    } catch (err: any) {
      setFormError(err?.message || 'वीडियो सहेजने में विफल रहा।');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.deleteVideo(deleteTarget.id);
      setDeleteTarget(null);
      setFeedback({ type: 'success', message: 'वीडियो बुलेटिन सफलतापूर्वक हटाया गया।' });
      await loadVideos();
    } catch (err: any) {
      setDeleteTarget(null);
      setFeedback({ type: 'error', message: err?.message || 'वीडियो हटाने में विफल रहा।' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="वीडियो बुलेटिन हटाने की पुष्टि"
        message={
          deleteTarget
            ? `क्या आप "${deleteTarget.title}" को स्थायी रूप से हटाना चाहते हैं?`
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
            aria-label="Dismiss video notification"
            className="p-1 rounded hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-red-700" />
          <h3 className="font-hindi-brand font-bold text-sm text-zinc-900">
            वीडियो बुलेटिन प्रबंधन ({videos.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="bg-red-700 hover:bg-red-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-hindi-brand font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>नया वीडियो जोड़ें</span>
        </button>
      </div>

      {/* Add / Edit Video Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-hindi-brand font-bold text-lg text-zinc-900 mb-4 pb-2 border-b border-zinc-200">
              {editingItem ? 'वीडियो बुलेटिन संपादित करें' : 'नया वीडियो बुलेटिन जोड़ें'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                  वीडियो शीर्षक (Title) *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="जैसे: प्राइम टाइम विश्लेषण — संसद सत्र का मुख्य सार"
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand focus:outline-hidden focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                  वीडियो विवरण (Description) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="बुलेटिन की मुख्य विषयवस्तु और बिंदु..."
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand focus:outline-hidden focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    श्रेणी (Category)
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    एंकर (Anchor)
                  </label>
                  <input
                    type="text"
                    value={formAnchor}
                    onChange={(e) => setFormAnchor(e.target.value)}
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    अवधि (Duration)
                  </label>
                  <input
                    type="text"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    placeholder="05:00"
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    बैज / टैग (Tag)
                  </label>
                  <input
                    type="text"
                    value={formTag}
                    onChange={(e) => setFormTag(e.target.value)}
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                  थंबनेल इमेज URL (https://...)
                </label>
                <input
                  type="url"
                  value={formThumbnailUrl}
                  onChange={(e) => setFormThumbnailUrl(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                  वीडियो स्ट्रीम URL (https://...)
                </label>
                <input
                  type="url"
                  value={formVideoUrl}
                  onChange={(e) => setFormVideoUrl(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-video-live"
                  checked={formIsLive}
                  onChange={(e) => setFormIsLive(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600"
                />
                <label
                  htmlFor="chk-video-live"
                  className="text-xs font-bold text-zinc-800 font-hindi-brand cursor-pointer"
                >
                  लाइव प्रसारण के रूप में चिह्नित करें (LIVE)
                </label>
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
                  {isSaving ? 'सहेजा जा रहा है...' : 'सहेजें व प्रकाशित करें'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video List */}
      <div className="divide-y divide-zinc-200">
        {isLoading && videos.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs font-hindi-brand font-bold">
            वीडियो बुलेटिन लोड हो रहे हैं...
          </div>
        ) : videos.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 font-hindi-brand">
            अभी कोई वीडियो बुलेटिन उपलब्ध नहीं है। ऊपर दिए गए बटन से नया वीडियो जोड़ें।
          </div>
        ) : (
          videos.map((item) => (
            <div
              key={item.id}
              className="p-4 flex items-start justify-between gap-4 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="relative w-24 h-14 rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-zinc-200">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-mono px-1 rounded flex items-center gap-0.5">
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>{item.duration}</span>
                  </div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded font-hindi-brand">
                      {item.category}
                    </span>
                    {item.isLive && (
                      <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded uppercase">
                        LIVE
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-500 font-hindi-brand">
                      प्रस्तोता: {item.anchor}
                    </span>
                  </div>
                  <h4 className="font-hindi-brand font-bold text-sm text-zinc-900 line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="text-xs text-zinc-500 font-hindi-brand line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
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
