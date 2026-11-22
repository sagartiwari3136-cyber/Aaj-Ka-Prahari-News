import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { MajorState, StateNewsItem } from '../types';
import { api } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';

const STATES: MajorState[] = ['दिल्ली', 'महाराष्ट्र', 'उत्तर प्रदेश', 'बिहार', 'पंजाब'];

const EMPTY_STATE_NEWS_MAP: Record<MajorState, StateNewsItem[]> = {
  दिल्ली: [],
  महाराष्ट्र: [],
  'उत्तर प्रदेश': [],
  बिहार: [],
  पंजाब: [],
};

export function CmsStateNewsTab() {
  const [selectedState, setSelectedState] = useState<MajorState>('दिल्ली');
  const [newsMap, setNewsMap] = useState<Record<MajorState, StateNewsItem[]>>(EMPTY_STATE_NEWS_MAP);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<StateNewsItem | null>(null);

  // Form State
  const [formState, setFormState] = useState<MajorState>('दिल्ली');
  const [formCity, setFormCity] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formReporter, setFormReporter] = useState('');
  const [formIsHeadline, setFormIsHeadline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [tabFeedback, setTabFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadAllStateNews();
  }, []);

  const loadAllStateNews = async () => {
    setIsLoading(true);
    try {
      const data = await api.getStateNews();
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setNewsMap({
          ...EMPTY_STATE_NEWS_MAP,
          ...(data as Record<MajorState, StateNewsItem[]>),
        });
      }
    } catch (err: any) {
      setTabFeedback({
        type: 'error',
        message: err?.message || 'राज्यवार समाचार लोड करने में त्रुटि हुई।',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormState(selectedState);
    setFormCity(selectedState === 'दिल्ली' ? 'नई दिल्ली' : selectedState === 'महाराष्ट्र' ? 'मुंबई' : selectedState === 'उत्तर प्रदेश' ? 'लखनऊ' : selectedState === 'बिहार' ? 'पटना' : 'मोहाली');
    setFormTitle('');
    setFormSummary('');
    setFormContent('');
    setFormImageUrl('https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&q=80&w=800');
    setFormReporter(`${selectedState} ब्यूरो संवाददाता`);
    setFormIsHeadline(false);
    setFormError('');
    setIsAdding(true);
  };

  const handleOpenEdit = (item: StateNewsItem) => {
    setEditingItem(item);
    setFormState(item.state || selectedState);
    setFormCity(item.city);
    setFormTitle(item.title);
    setFormSummary(item.summary);
    setFormContent(item.content || item.summary);
    setFormImageUrl(item.imageUrl);
    setFormReporter(item.reporter);
    setFormIsHeadline(Boolean(item.isHeadline));
    setFormError('');
    setIsAdding(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!formTitle.trim() || !formSummary.trim()) {
      setFormError('कृपया शीर्षक और विवरण दोनों भरें।');
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      if (editingItem) {
        await api.updateStateNews(editingItem.id, {
          state: formState,
          city: formCity,
          title: formTitle,
          summary: formSummary,
          content: formContent,
          imageUrl: formImageUrl,
          reporter: formReporter,
          isHeadline: formIsHeadline,
        });
        setTabFeedback({ type: 'success', message: 'प्रादेशिक खबर सफलतापूर्वक अपडेट की गई।' });
      } else {
        await api.createStateNews({
          state: formState,
          city: formCity,
          title: formTitle,
          summary: formSummary,
          content: formContent,
          imageUrl: formImageUrl,
          reporter: formReporter,
          isHeadline: formIsHeadline,
        });
        setTabFeedback({ type: 'success', message: `${formState} की नई खबर सफलतापूर्वक जोड़ी गई।` });
      }
      setSelectedState(formState);
      setIsAdding(false);
      await loadAllStateNews();
    } catch (err: any) {
      setFormError(`त्रुटि: ${err?.message || 'खबर सहेजने में विफल रहा'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.deleteStateNews(deleteTargetId);
      setDeleteTargetId(null);
      setTabFeedback({ type: 'success', message: 'प्रादेशिक खबर सफलतापूर्वक हटाई गई।' });
      await loadAllStateNews();
    } catch (err: any) {
      setDeleteTargetId(null);
      setTabFeedback({
        type: 'error',
        message: `त्रुटि: ${err?.message || 'खबर हटाने में विफल रहा'}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const currentList = newsMap[selectedState] || [];

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        title="प्रादेशिक खबर हटाने की पुष्टि"
        message="क्या आप इस प्रादेशिक खबर को स्थायी रूप से हटाना चाहते हैं?"
        confirmLabel="हाँ, हटाएं"
        cancelLabel="रद्द करें"
        tone="danger"
        theme="light"
        isProcessing={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTargetId(null);
        }}
      />

      {tabFeedback && (
        <div
          role={tabFeedback.type === 'error' ? 'alert' : 'status'}
          className={`mx-4 mt-4 px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
            tabFeedback.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {tabFeedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
            )}
            <span>{tabFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setTabFeedback(null)}
            aria-label="Dismiss state news message"
            className="p-1 rounded hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* State Switcher Bar */}
      <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {STATES.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedState(st)}
              className={`px-3.5 py-1.5 rounded-xl font-hindi-brand text-xs font-bold transition-all cursor-pointer ${
                selectedState === st
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {st} ({newsMap[st]?.length || 0})
            </button>
          ))}
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-red-700 hover:bg-red-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-hindi-brand font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>नई {selectedState} खबर जोड़ें</span>
        </button>
      </div>

      {/* Editor Modal for State News */}
      {isAdding && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-hindi-brand font-bold text-lg text-zinc-900 mb-4 pb-2 border-b border-zinc-200">
              {editingItem ? 'प्रादेशिक खबर संपादित करें' : `नई खबर जोड़ें: ${selectedState}`}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="state-news-select" className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    राज्य
                  </label>
                  <select
                    id="state-news-select"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value as MajorState)}
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-red-600"
                  >
                    {STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    शहर / क्षेत्र
                  </label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="उदा. नई दिल्ली, नोएडा, वाराणसी"
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand focus:outline-hidden focus:ring-1 focus:ring-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                  खबर का मुख्य शीर्षक (Headline)
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="आकर्षक व तथ्यात्मक हिंदी शीर्षक"
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand focus:outline-hidden focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                  संक्षिप्त विवरण (Summary)
                </label>
                <textarea
                  required
                  rows={2}
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="2 पंक्तियों में खबर का मुख्य सार"
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand focus:outline-hidden focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                  विस्तृत रिपोर्ट (Full Content)
                </label>
                <textarea
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="खबर की पूरी रिपोर्टिंग और विवरण..."
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand focus:outline-hidden focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    संवाददाता का नाम
                  </label>
                  <input
                    type="text"
                    value={formReporter}
                    onChange={(e) => setFormReporter(e.target.value)}
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-hindi-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 font-hindi-brand mb-1">
                    इमेज URL
                  </label>
                  <input
                    type="text"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chk-headline"
                  checked={formIsHeadline}
                  onChange={(e) => setFormIsHeadline(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600"
                />
                <label htmlFor="chk-headline" className="text-xs font-bold text-zinc-800 font-hindi-brand cursor-pointer">
                  इस राज्य की मुख्य हेडलाइन (Lead Story) बनाएं
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
                  onClick={() => setIsAdding(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-hindi-brand font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl disabled:opacity-50"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white px-5 py-2 text-xs font-hindi-brand font-bold rounded-xl shadow-xs"
                >
                  {isSaving ? 'सहेजा जा रहा है...' : 'सहेजें व प्रकाशित करें'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* State Stories Table */}
      <div className="divide-y divide-zinc-200">
        {isLoading && currentList.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs font-hindi-brand font-bold">
            राज्यवार समाचार लोड हो रहे हैं...
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 font-hindi-brand">
            इस राज्य के लिए कोई खबर उपलब्ध नहीं है।
          </div>
        ) : (
          currentList.map((item) => (
            <div key={item.id} className="p-4 flex items-start justify-between gap-4 hover:bg-zinc-50 transition-colors">
              <div className="flex items-start gap-3">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-20 h-14 rounded-lg object-cover shrink-0 border border-zinc-200"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.2 rounded font-hindi-brand">
                      {item.city}
                    </span>
                    {item.isHeadline && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded font-hindi-brand">
                        ★ लीड हेडलाइन
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 font-hindi-brand">
                      {new Date(item.publishedAt).toLocaleDateString('hi-IN')}
                    </span>
                  </div>
                  <h4 className="font-hindi-brand font-bold text-sm text-zinc-900 line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="text-xs text-zinc-500 font-hindi-brand line-clamp-1 mt-0.5">
                    {item.summary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                  title="संपादित करें"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
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
