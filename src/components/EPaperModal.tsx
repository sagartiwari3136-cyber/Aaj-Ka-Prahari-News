import React, { useState } from 'react';
import {
  X,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar,
  MapPin,
  Maximize2,
  Newspaper,
  Share2,
} from 'lucide-react';

interface EPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EPaperModal({ isOpen, onClose }: EPaperModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEdition, setSelectedEdition] = useState('दिल्ली-NCR');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const editions = ['दिल्ली-NCR', 'उत्तर प्रदेश', 'मुंबई', 'बिहार', 'मध्य प्रदेश'];
  const totalPages = 8;

  const todayStr = new Intl.DateTimeFormat('hi-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#f7f5ed] border border-stone-300 w-full max-w-5xl h-full sm:h-[94vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden relative font-hindi-brand">
        {/* Top Control Bar */}
        <div className="bg-[#0b1f3a] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-blue-900 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center font-bold text-white text-xs shadow-inner">
              AKP
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                <span>दैनिक ई-पेपर संस्करण</span>
                <span className="text-[10px] bg-amber-400 text-zinc-950 px-1.5 py-0.2 rounded font-bold uppercase">
                  Digital Edition
                </span>
              </div>
              <div className="text-[11px] text-blue-200 flex items-center gap-2">
                <Calendar className="w-3 h-3 text-amber-300" />
                <span>{todayStr}</span>
              </div>
            </div>
          </div>

          {/* Edition Selector */}
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-amber-300 hidden sm:inline" />
            <select
              value={selectedEdition}
              onChange={(e) => setSelectedEdition(e.target.value)}
              className="bg-[#08172c] text-white text-xs border border-blue-800 rounded px-2.5 py-1 focus:outline-hidden focus:border-amber-400 cursor-pointer"
            >
              {editions.map((ed) => (
                <option key={ed} value={ed}>
                  {ed} संस्करण
                </option>
              ))}
            </select>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-[#08172c] border border-blue-800 rounded px-1 text-xs">
              <button
                onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
                className="p-1 hover:text-amber-300 text-zinc-300"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[11px] font-mono text-blue-200">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
                className="p-1 hover:text-amber-300 text-zinc-300"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => {
                setDownloadNotice(`डाउनलोड तैयार: ${selectedEdition} ई-पेपर संस्करण (${todayStr})`);
              }}
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-2.5 py-1 rounded text-xs transition-colors cursor-pointer"
              title="PDF डाउनलोड करें"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">डाउनलोड PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 bg-[#08172c] hover:bg-red-600 rounded text-zinc-300 hover:text-white transition-colors cursor-pointer border border-blue-800"
              title="बंद करें"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {downloadNotice && (
          <div
            role="status"
            className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-900 flex items-center justify-between gap-3"
          >
            <span>{downloadNotice}</span>
            <button
              type="button"
              onClick={() => setDownloadNotice(null)}
              aria-label="Close download notice"
              className="p-0.5 rounded hover:bg-emerald-200/60 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Paper Page Viewer Area */}
        <div className="flex-1 overflow-auto bg-[#e5e0d4] p-3 sm:p-6 flex justify-center items-start">
          <div
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className="w-full max-w-3xl bg-white shadow-2xl border border-stone-300 p-6 sm:p-8 transition-transform duration-150 rounded-xs"
          >
            {/* Newspaper Replica Masthead */}
            <div className="text-center border-b-4 border-double border-zinc-900 pb-3 mb-4">
              <div className="flex items-center justify-between text-[10px] text-zinc-600 uppercase tracking-widest font-mono border-b border-zinc-300 pb-1 mb-2">
                <span>RNI NO: 45892/88</span>
                <span>{selectedEdition} संस्करण • अंक 245</span>
                <span>मूल्य: ₹5.00</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-zinc-950 mb-1">
                आज का प्रहरी
              </h1>
              <p className="text-xs font-bold text-red-700 tracking-wider uppercase">
                राष्ट्र का अग्रणी एवं निष्पक्ष हिंदी दैनिक
              </p>
            </div>

            {/* Simulated News Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-zinc-300 pb-6 mb-4">
              {/* Main Headline Story (Spans 2 cols) */}
              <div className="md:col-span-2 border-r-0 md:border-r border-zinc-200 md:pr-4">
                <span className="bg-red-700 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                  मुख्य समाचार • पेज {currentPage}
                </span>
                <h2 className="text-2xl font-black text-zinc-950 leading-tight mt-2 mb-2">
                  आगामी बजट व नीतिगत सुधारों को लेकर संसद में आज ऐतिहासिक चर्चा, विकास योजनाओं पर विशेष जोर
                </h2>
                <div className="w-full h-44 bg-zinc-200 overflow-hidden mb-3 relative rounded-xs">
                  <img
                    src="https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&q=80&w=900"
                    alt="संसद भवन"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 font-sans">
                    विशेष ब्यूरो: नई दिल्ली में संसद सत्र का सीधा नजारा।
                  </div>
                </div>
                <p className="text-xs text-zinc-800 leading-relaxed font-serif text-justify">
                  संसद के विशेष सत्र में आज आर्थिक मजबूती, रोजगार संवर्धन तथा बुनियादी ढांचे के आधुनिकीकरण पर महत्वपूर्ण नीतिगत रूपरेखा प्रस्तुत की गई। सभी प्रमुख दलों के प्रवक्ताओं ने जनहित से जुड़े मुद्दों पर अपने विचार रखे।
                </p>
              </div>

              {/* Side Column */}
              <div className="space-y-4">
                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-[10px] font-bold text-blue-900 uppercase">राज्य बुलेटिन</span>
                  <h3 className="text-sm font-bold text-zinc-950 leading-snug mt-1 mb-1">
                    {selectedEdition} में विकास परियोजनाओं का हुआ शुभारंभ
                  </h3>
                  <p className="text-[11px] text-zinc-600 leading-normal font-serif">
                    मुख्यमंत्री ने कनेक्टिविटी और जनसुविधाओं को बेहतर करने के लिए नए कॉरिडोर का उद्घाटन किया।
                  </p>
                </div>

                <div className="border-b border-zinc-200 pb-3">
                  <span className="text-[10px] font-bold text-green-900 uppercase">कारोबार</span>
                  <h3 className="text-sm font-bold text-zinc-950 leading-snug mt-1 mb-1">
                    सेंसेक्स में भारी उछाल, निवेशकों में उत्साह
                  </h3>
                  <p className="text-[11px] text-zinc-600 leading-normal font-serif">
                    घरेलू बाजार में विदेशी निवेशकों की खरीदारी जारी रहने से मुख्य सूचकांक रिकॉर्ड स्तर पर पहुंचे।
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-red-900 uppercase">मौसम का हाल</span>
                  <p className="text-[11px] text-zinc-700 leading-normal font-serif mt-1">
                    उत्तर भारत में मौसम सामान्य, आने वाले 48 घंटों में हल्की बूंदाबांदी के आसार।
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom editorial banner */}
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-300">
              <span>ई-कॉपी केवल निजी उपयोग के लिए मान्य • AKP News Network</span>
              <span className="font-mono">पेज संख्या {currentPage} / {totalPages}</span>
            </div>
          </div>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="bg-[#0b1f3a] text-white px-4 py-2.5 flex items-center justify-between border-t border-blue-900">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
              currentPage === 1
                ? 'opacity-40 cursor-not-allowed bg-blue-950 text-blue-400'
                : 'bg-blue-900 hover:bg-blue-800 text-white'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>पिछला पेज</span>
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                className={`w-7 h-7 rounded text-xs font-bold transition-all cursor-pointer ${
                  currentPage === pg
                    ? 'bg-amber-400 text-zinc-950 shadow-xs'
                    : 'bg-[#08172c] hover:bg-blue-800 text-blue-200'
                }`}
              >
                {pg}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
              currentPage === totalPages
                ? 'opacity-40 cursor-not-allowed bg-blue-950 text-blue-400'
                : 'bg-blue-900 hover:bg-blue-800 text-white'
            }`}
          >
            <span>अगला पेज</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
