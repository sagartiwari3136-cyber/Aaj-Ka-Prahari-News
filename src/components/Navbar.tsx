import { useState } from 'react';
import {
  Search,
  Menu,
  ChevronDown,
  Newspaper,
} from 'lucide-react';
import { Category, Edition } from '../types';
import { CATEGORIES, SPECIAL_TOPIC_LINKS } from '../data/initialData';
import { BrandLogo } from './BrandLogo';

interface NavbarProps {
  activeCategory: Category;
  onSelectCategory: (category: Category) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenLiveFeed: () => void;
  liveUpdatesCount: number;
  currentEdition?: Edition;
  onSelectEdition?: (edition: Edition) => void;
  onSelectSpecialTopic?: (topic: string) => void;
  onOpenSidebarMenu: () => void;
  onOpenEPaper: () => void;
}

export function Navbar({
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onOpenLiveFeed,
  onSelectSpecialTopic,
  onOpenSidebarMenu,
  onOpenEPaper,
}: NavbarProps) {
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);

  const indianCities = [
    'दिल्ली-NCR',
    'मुंबई',
    'लखनऊ',
    'मोहाली/चंडीगढ़',
    'पटना',
    'भोपाल',
    'जयपुर',
    'कोलकाता',
  ];

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      {/* 1. Top Primary Nav Header (Refined Light Newspaper Masthead Theme) */}
      <div className="bg-white text-zinc-900 border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 flex items-center justify-between h-14 sm:h-16">
          {/* Left: Hamburger & Brand Logo */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              onClick={onOpenSidebarMenu}
              className="p-1.5 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 rounded-md cursor-pointer transition-colors"
              title="मेन्यू खोलें"
              aria-label="मेन्यू खोलें"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Circular NDTV / AKP News Red Badge Logo in Light Scheme */}
            <BrandLogo
              variant="circle"
              theme="light"
              onClick={() => {
                onSelectCategory('All');
                onSearchChange('');
              }}
            />
          </div>

          {/* Center: Main Editorial Nav Desks (Hindi) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 text-xs xl:text-sm font-hindi-brand font-medium">
            {/* LIVE TV Button with pulsating red dot */}
            <button
              onClick={onOpenLiveFeed}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-white bg-red-600 hover:bg-red-700 font-bold transition-all cursor-pointer mr-1 shadow-xs"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span>LIVE टीवी</span>
              <ChevronDown className="w-3 h-3 text-white/90" />
            </button>

            {/* ताज़ातरीन */}
            <button
              onClick={() => onSelectCategory('All')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-bold ${
                activeCategory === 'All'
                  ? 'text-red-700 bg-red-50 font-bold border-b-2 border-red-700'
                  : 'text-zinc-700 hover:text-red-700 hover:bg-zinc-50'
              }`}
            >
              ताज़ातरीन
            </button>

            {/* देश */}
            <button
              onClick={() => onSelectCategory('देश')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activeCategory === 'देश'
                  ? 'text-red-700 bg-red-50 font-bold border-b-2 border-red-700'
                  : 'text-zinc-700 hover:text-red-700 hover:bg-zinc-50'
              }`}
            >
              देश
            </button>

            {/* शहर Dropdown */}
            <div className="relative">
              <button
                onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeCategory === 'शहर'
                    ? 'text-red-700 bg-red-50 font-bold border-b-2 border-red-700'
                    : 'text-zinc-700 hover:text-red-700 hover:bg-zinc-50'
                }`}
              >
                <span>शहर व राज्य</span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>

              {cityDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in duration-150">
                  {indianCities.map((city) => (
                    <button
                      key={city}
                      onClick={() => {
                        onSelectCategory('शहर');
                        if (onSelectSpecialTopic) onSelectSpecialTopic(city);
                        setCityDropdownOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-zinc-700 hover:bg-red-50 hover:text-red-700 font-hindi-brand transition-colors"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* क्रिकेट */}
            <button
              onClick={() => onSelectCategory('क्रिकेट')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activeCategory === 'क्रिकेट'
                  ? 'text-red-700 bg-red-50 font-bold border-b-2 border-red-700'
                  : 'text-zinc-700 hover:text-red-700 hover:bg-zinc-50'
              }`}
            >
              क्रिकेट
            </button>

            {/* फटाफट / लाइव */}
            <button
              onClick={onOpenLiveFeed}
              className="px-2.5 py-1 rounded-md text-zinc-700 hover:text-red-700 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              फटाफट
            </button>

            {/* मनोरंजन */}
            <button
              onClick={() => onSelectCategory('मनोरंजन')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activeCategory === 'मनोरंजन'
                  ? 'text-red-700 bg-red-50 font-bold border-b-2 border-red-700'
                  : 'text-zinc-700 hover:text-red-700 hover:bg-zinc-50'
              }`}
            >
              मनोरंजन
            </button>

            {/* वीडियो */}
            <a
              href="#video-news-section"
              className="px-2.5 py-1 rounded-md text-zinc-700 hover:text-red-700 hover:bg-zinc-50 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>वीडियो</span>
            </a>

            {/* लाइफस्टाइल */}
            <button
              onClick={() => onSelectCategory('लाइफस्टाइल')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activeCategory === 'लाइफस्टाइल'
                  ? 'text-red-700 bg-red-50 font-bold border-b-2 border-red-700'
                  : 'text-zinc-700 hover:text-red-700 hover:bg-zinc-50'
              }`}
            >
              लाइफस्टाइल
            </button>

            {/* और भी (Dropdown for कारोबार, विदेश, तकनीक, संपादकीय) */}
            <div className="relative">
              <button
                onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-zinc-700 hover:text-red-700 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span>और भी</span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>

              {moreDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl py-1.5 z-50">
                  <button
                    onClick={() => {
                      onSelectCategory('कारोबार');
                      setMoreDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 hover:bg-red-50 hover:text-red-700 font-hindi-brand"
                  >
                    कारोबार
                  </button>
                  <button
                    onClick={() => {
                      onSelectCategory('विदेश');
                      setMoreDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 hover:bg-red-50 hover:text-red-700 font-hindi-brand"
                  >
                    विदेश
                  </button>
                  <button
                    onClick={() => {
                      onSelectCategory('तकनीक');
                      setMoreDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 hover:bg-red-50 hover:text-red-700 font-hindi-brand"
                  >
                    तकनीक
                  </button>
                  <button
                    onClick={() => {
                      onSelectCategory('संपादकीय');
                      setMoreDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 hover:bg-red-50 hover:text-red-700 font-hindi-brand"
                  >
                    संपादकीय
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* Right: E-Paper Edition */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              onClick={onOpenEPaper}
              className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-300 transition-colors cursor-pointer font-hindi-brand shadow-2xs"
              title="दैनिक ई-पेपर पढ़ें"
            >
              <Newspaper className="w-3.5 h-3.5 text-amber-600" />
              <span>ई-पेपर</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Special Links / Trending Topics Bar ("विशेष लिंक" in light neutral styling) */}
      <div className="bg-[#F6F5EE] text-zinc-800 border-b border-zinc-200 text-xs sm:text-sm py-2 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-hidden">
          {/* Trending Topics List */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar py-0.5">
            {/* विशेष लिंक Badge */}
            <div className="flex items-center gap-1 font-bold text-red-700 shrink-0 font-hindi-brand">
              <span className="hover:underline cursor-pointer">विशेष लिंक</span>
              <span className="text-red-600 font-sans">›</span>
            </div>

            {/* Topic Badges */}
            {SPECIAL_TOPIC_LINKS.map((topic) => (
              <button
                key={topic.id}
                onClick={() => {
                  if (onSelectSpecialTopic) onSelectSpecialTopic(topic.title);
                  onSearchChange(topic.title);
                }}
                className="shrink-0 text-zinc-700 hover:text-red-700 hover:underline transition-colors font-hindi-brand font-medium cursor-pointer"
              >
                {topic.title}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative shrink-0 hidden md:block w-48 lg:w-60">
            <input
              type="text"
              placeholder="खबर खोजें..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-white border border-zinc-300 text-zinc-900 rounded-full py-1 pl-7 pr-3 text-xs placeholder:text-zinc-400 focus:outline-hidden focus:border-red-600 focus:ring-1 focus:ring-red-600 font-hindi-brand shadow-2xs"
            />
            <Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

