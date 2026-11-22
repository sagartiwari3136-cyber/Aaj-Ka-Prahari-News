import React, { useState } from 'react';
import {
  X,
  Share2,
  Clock,
  Check,
} from 'lucide-react';
import { Article } from '../types';
import { BrandLogo } from './BrandLogo';

interface ArticleReaderModalProps {
  article: Article | null;
  onClose: () => void;
  onSelectArticle: (article: Article) => void;
  relatedArticles: Article[];
}

export function ArticleReaderModal({
  article,
  onClose,
  onSelectArticle,
  relatedArticles,
}: ArticleReaderModalProps) {
  const [fontSizeLevel, setFontSizeLevel] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [isSerif] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!article) return null;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const formattedDate = new Date(article.publishedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const fontClass =
    fontSizeLevel === 'large'
      ? 'text-lg sm:text-xl leading-relaxed'
      : fontSizeLevel === 'xlarge'
      ? 'text-xl sm:text-2xl leading-loose'
      : 'text-base sm:text-lg leading-relaxed';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#FAF9F5] border border-[#E0DED5] w-full max-w-4xl min-h-screen sm:min-h-0 sm:max-h-[92vh] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden relative">
        {/* Sticky Header Reader Bar */}
        <div className="sticky top-0 z-20 bg-[#FAF9F5]/95 backdrop-blur-md border-b border-[#E5E3D8] px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo variant="mini" />
            <span className="text-zinc-300 hidden sm:inline">•</span>
            <span className="bg-red-100 text-red-900 border border-red-200 text-[11px] font-bold px-2 py-0.5 rounded font-hindi-brand">
              {article.category} डेस्क
            </span>
          </div>

          {/* Reading Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Typography scale buttons */}
            <div className="flex items-center bg-zinc-100 rounded p-0.5 text-zinc-700">
              <button
                onClick={() => setFontSizeLevel('normal')}
                className={`px-2 py-0.5 text-xs rounded ${
                  fontSizeLevel === 'normal' ? 'bg-white font-bold shadow-2xs' : ''
                }`}
                title="सामान्य फ़ॉन्ट"
              >
                A
              </button>
              <button
                onClick={() => setFontSizeLevel('large')}
                className={`px-2 py-0.5 text-sm rounded ${
                  fontSizeLevel === 'large' ? 'bg-white font-bold shadow-2xs' : ''
                }`}
                title="बड़ा फ़ॉन्ट"
              >
                A+
              </button>
            </div>

            {/* Share */}
            <button
              onClick={handleShare}
              className="p-1.5 text-zinc-600 hover:text-zinc-900 rounded hover:bg-zinc-100 cursor-pointer"
              title="लिंक कॉपी करें"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-600 hover:text-zinc-950 rounded-lg hover:bg-zinc-200 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Article Body */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 max-w-3xl mx-auto w-full">
          {/* Article Header */}
          <div className="border-b border-zinc-200 pb-6 mb-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-700 mb-3">
              <span>{article.category}</span>
              {article.subCategory && (
                <>
                  <span className="text-zinc-300">•</span>
                  <span className="text-zinc-600">{article.subCategory}</span>
                </>
              )}
            </div>

            <h1 className="font-serif-headline text-2xl sm:text-4xl lg:text-5xl font-bold text-zinc-950 leading-[1.15] mb-4">
              {article.title}
            </h1>

            <p className="text-lg sm:text-xl text-zinc-700 font-normal leading-relaxed mb-6 font-serif-headline italic">
              {article.summary}
            </p>

            {/* Author Byline & Date */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-200 text-xs text-zinc-600">
              <div className="flex items-center gap-3">
                <img
                  src={article.author.avatar}
                  alt={article.author.name}
                  className="w-11 h-11 rounded-full object-cover border border-zinc-300 shadow-2xs"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="font-bold text-zinc-900 text-sm">{article.author.name}</div>
                  <div className="text-zinc-500">{article.author.role}</div>
                </div>
              </div>

              <div className="flex flex-col sm:items-end text-zinc-500">
                <div className="flex items-center gap-1.5 font-medium text-zinc-700">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{article.readTime}</span>
                  <span>•</span>
                  <span>{formattedDate}</span>
                </div>
                {article.location && (
                  <span className="text-[11px] text-zinc-400">Dateline: {article.location}</span>
                )}
              </div>
            </div>
          </div>

          {/* Lead Photo */}
          <div className="mb-8">
            <div className="rounded-xl overflow-hidden aspect-16/10 bg-zinc-200 border border-zinc-200">
              <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            {article.imageCaption && (
              <div className="mt-2 text-xs text-zinc-500 flex items-start justify-between gap-4 italic px-1">
                <span>{article.imageCaption}</span>
                {article.imagePhotographer && (
                  <span className="text-[10px] text-zinc-400 font-mono-data shrink-0 not-italic">
                    {article.imagePhotographer}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Article Text Content */}
          <div
            className={`prose prose-zinc max-w-none text-zinc-800 ${fontClass} ${
              isSerif ? 'font-serif-headline' : 'font-sans'
            }`}
          >
            {article.content.split('\n\n').map((para, pIdx) => {
              if (para.startsWith('### ')) {
                return (
                  <h3
                    key={pIdx}
                    className="font-bold text-xl sm:text-2xl text-zinc-950 mt-8 mb-3 not-italic font-sans"
                  >
                    {para.replace('### ', '')}
                  </h3>
                );
              }
              if (para.startsWith('```')) {
                return (
                  <pre
                    key={pIdx}
                    className="bg-zinc-900 text-zinc-100 p-4 rounded-lg my-4 text-xs font-mono-data overflow-x-auto not-italic"
                  >
                    {para.replace(/```/g, '')}
                  </pre>
                );
              }
              if (para.startsWith('> ')) {
                return (
                  <blockquote
                    key={pIdx}
                    className="border-l-4 border-rose-600 pl-4 my-6 italic text-zinc-700 font-serif-headline text-lg"
                  >
                    {para.replace('> ', '')}
                  </blockquote>
                );
              }

              // Normal paragraph with dropcap for first paragraph
              return (
                <p
                  key={pIdx}
                  className={`mb-5 text-justify leading-relaxed ${
                    pIdx === 0 ? 'first-letter-dropcap' : ''
                  }`}
                >
                  {para}
                </p>
              );
            })}
          </div>

          {/* Tags */}
          <div className="mt-8 pt-6 border-t border-zinc-200">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 font-hindi-brand">
              प्रमुख विषय व टैग्स:
            </div>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs px-3 py-1 rounded-full font-medium transition-colors font-hindi-brand"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Author Biography Box */}
          <div className="mt-8 p-5 bg-white border border-[#E5E3D8] rounded-xl flex items-start gap-4">
            <img
              src={article.author.avatar}
              alt={article.author.name}
              className="w-14 h-14 rounded-full object-cover border border-zinc-200 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <h4 className="font-bold text-zinc-900 text-sm font-hindi-brand">{article.author.name} (परिचय)</h4>
              <p className="text-xs text-zinc-600 mt-1 leading-relaxed font-hindi-brand">
                {article.author.bio ||
                  `${article.author.name} 'आज का प्रहरी' में ${article.category} एवं विशेष रिपोर्टिंग के वरिष्ठ पत्रकार हैं।`}
              </p>
            </div>
          </div>

          {/* Related Articles Carousel */}
          {relatedArticles.length > 0 && (
            <div className="mt-12 pt-8 border-t-2 border-zinc-900">
              <h3 className="font-hindi-brand text-lg font-bold text-zinc-900 mb-4 tracking-tight">
                संबंधित प्रमुख खबरें
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedArticles.slice(0, 2).map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => {
                      onSelectArticle(rel);
                    }}
                    className="group cursor-pointer bg-white p-3.5 rounded-lg border border-zinc-200 hover:border-zinc-400 transition-all flex gap-3"
                  >
                    <img
                      src={rel.imageUrl}
                      alt={rel.title}
                      className="w-20 h-20 rounded object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="text-[10px] font-bold uppercase text-red-700 mb-0.5 font-hindi-brand">
                        {rel.category}
                      </div>
                      <h4 className="font-hindi-brand text-xs font-bold text-zinc-900 group-hover:text-red-700 leading-snug line-clamp-2">
                        {rel.title}
                      </h4>
                      <span className="text-[10px] text-zinc-400 mt-1 block font-hindi-brand">{rel.readTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
