import React, { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Newspaper,
} from 'lucide-react';
import { Category } from '../types';

interface SidebarMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (category: Category) => void;
  onSelectTopic: (topic: string) => void;
  onOpenEPaper: () => void;
}

interface MenuItem {
  id: string;
  title: string;
  isHighlighted?: boolean;
  category?: Category;
  topic?: string;
  subItems?: { title: string; topic?: string; category?: Category }[];
}

export function SidebarMenuDrawer({
  isOpen,
  onClose,
  onSelectCategory,
  onSelectTopic,
  onOpenEPaper,
}: SidebarMenuDrawerProps) {
  // Track open accordion sections
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});

  const toggleSubMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenSubMenus((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Exactly matching the list in the reference image
  const menuList: MenuItem[] = [
    {
      id: 'gen-z',
      title: 'जेन-ज़ी',
      topic: 'जेन-ज़ी',
    },
    {
      id: 'quick-jobs',
      title: 'क्विक जॉब्स',
      topic: 'जॉब्स',
    },
    {
      id: 'web-story',
      title: 'वेब स्टोरी',
      topic: 'वेब स्टोरी',
    },
    {
      id: 'video',
      title: 'वीडियो',
      topic: 'वीडियो',
    },
    {
      id: 'business',
      title: 'बिजनेस',
      category: 'कारोबार',
      subItems: [
        { title: 'शेयर बाजार', topic: 'शेयर बाजार', category: 'कारोबार' },
        { title: 'म्यूचुअल फंड', topic: 'म्यूचुअल फंड', category: 'कारोबार' },
        { title: 'पर्सनल फाइनेंस', topic: 'पर्सनल फाइनेंस', category: 'कारोबार' },
        { title: 'क्रिप्टोकरेंसी', topic: 'क्रिप्टो', category: 'कारोबार' },
        { title: 'केंद्रीय बजट', topic: 'बजट', category: 'कारोबार' },
      ],
    },
    {
      id: 'calculators',
      title: 'कैलकुलेटर्स',
      topic: 'कैलकुलेटर',
      subItems: [
        { title: 'इनकम टैक्स कैलकुलेटर', topic: 'इनकम टैक्स' },
        { title: 'SIP रिटर्न कैलकुलेटर', topic: 'SIP' },
        { title: 'होम लोन EMI कैलकुलेटर', topic: 'होम लोन EMI' },
        { title: 'PPF कैलकुलेटर', topic: 'PPF' },
      ],
    },
    {
      id: 'ai',
      title: 'AI',
      category: 'तकनीक',
      subItems: [
        { title: 'AI टूल्स व रोबोटिक्स', topic: 'AI टूल्स', category: 'तकनीक' },
        { title: 'ChatGPT एवं LLM', topic: 'ChatGPT', category: 'तकनीक' },
        { title: 'डीपफेक अलर्ट', topic: 'डीपफेक', category: 'तकनीक' },
        { title: 'टेक इनोवेशन', topic: 'टेक इनोवेशन', category: 'तकनीक' },
      ],
    },
    {
      id: 'information',
      title: 'इन्फ़ॉर्मेशन',
      topic: 'जानकारी',
    },
    {
      id: 'world',
      title: 'विश्व',
      category: 'विदेश',
    },
    {
      id: 'crime',
      title: 'जुर्म',
      topic: 'क्राइम',
    },
    {
      id: 'tech',
      title: 'टेक्नोलॉजी',
      category: 'तकनीक',
      subItems: [
        { title: 'मोबाइल एवं स्मार्टफोन्स', topic: 'स्मार्टफोन', category: 'तकनीक' },
        { title: 'गैजेट रिव्यूज', topic: 'गैजेट्स', category: 'तकनीक' },
        { title: 'साइबर सुरक्षा', topic: 'साइबर सुरक्षा', category: 'तकनीक' },
        { title: 'ऐप्स व सॉफ्टवेयर', topic: 'सॉफ्टवेयर', category: 'तकनीक' },
      ],
    },
    {
      id: 'upcoming-elections',
      title: 'आगामी चुनाव',
      isHighlighted: true, // Bright golden text as in reference image
      topic: 'चुनाव 2026',
      subItems: [
        { title: 'विधानसभा चुनाव 2026', topic: 'विधानसभा चुनाव' },
        { title: 'सीट-वार समीकरण', topic: 'सीट समीकरण' },
        { title: 'ओपिनियन पोल', topic: 'ओपिनियन पोल' },
        { title: 'प्रत्याशी व घोषणापत्र', topic: 'घोषणापत्र' },
      ],
    },
    {
      id: 'past-elections',
      title: 'पिछले चुनाव',
      topic: 'चुनाव नतीजे',
      subItems: [
        { title: 'लोकसभा चुनाव परिणाम', topic: 'लोकसभा परिणाम' },
        { title: 'राज्यवार वोट शेयर', topic: 'वोट शेयर' },
        { title: 'चुनावी इतिहास व डेटा', topic: 'चुनावी इतिहास' },
      ],
    },
    {
      id: 'travel',
      title: 'सैर-सपाटा',
      topic: 'पर्यटन',
    },
    {
      id: 'education',
      title: 'एजुकेशन',
      topic: 'शिक्षा',
      subItems: [
        { title: 'बोर्ड परीक्षाएं 10वीं/12वीं', topic: 'बोर्ड परीक्षा' },
        { title: 'सरकारी नौकरी भर्ती', topic: 'सरकारी नौकरी' },
        { title: 'करियर गाइडेंस', topic: 'करियर' },
        { title: 'स्कॉलरशिप अपडेट्स', topic: 'स्कॉलरशिप' },
      ],
    },
    {
      id: 'defense',
      title: 'डिफेंस न्यूज',
      topic: 'सेना व सुरक्षा',
    },
    {
      id: 'culture',
      title: 'कला-संस्कृति',
      topic: 'संस्कृति',
    },
  ];

  const handleItemClick = (item: MenuItem) => {
    if (item.subItems && item.subItems.length > 0) {
      // Toggle accordion if it has subitems
      setOpenSubMenus((prev) => ({
        ...prev,
        [item.id]: !prev[item.id],
      }));
      return;
    }

    if (item.category) {
      onSelectCategory(item.category);
    } else if (item.topic) {
      onSelectTopic(item.topic);
    }
    onClose();
  };

  const handleSubItemClick = (sub: { title: string; topic?: string; category?: Category }) => {
    if (sub.category) {
      onSelectCategory(sub.category);
    }
    if (sub.topic) {
      onSelectTopic(sub.topic);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 left-0 w-[300px] sm:w-[320px] max-w-[85vw] bg-[#071d41] text-white shadow-2xl flex flex-col z-50 border-r border-[#0e2c56] animate-in slide-in-from-left duration-200 select-none">
        {/* Drawer Header (Ref. Image: Aaj Tak icon on left, Yellow e-paper button in center, X on right) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#0e2c56] bg-[#061836]">
          {/* Brand Icon (Curved Shield / Lozenge with Red & White Aaj Tak styling) */}
          <div
            onClick={() => {
              onSelectCategory('All');
              onClose();
            }}
            className="flex items-center gap-2 cursor-pointer group"
            title="आज का प्रहरी / एकेपी न्यूज होम"
          >
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-b from-[#e01c24] via-[#cc151d] to-[#9e0f15] border-2 border-white/95 shadow-md flex flex-col items-center justify-center transform group-hover:scale-105 transition-transform shrink-0">
              <span className="text-[11px] font-black font-hindi-brand text-white leading-none">
                आज
              </span>
              <span className="text-[11px] font-black font-hindi-brand text-white leading-none -mt-0.5">
                तक
              </span>
            </div>
          </div>

          {/* E-Paper Pill Button (Golden border and text as shown in reference image) */}
          <button
            onClick={() => {
              onOpenEPaper();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded border border-amber-400 text-amber-400 hover:bg-amber-400/10 active:scale-95 transition-all text-xs sm:text-sm font-semibold font-hindi-brand shadow-xs cursor-pointer"
            title="दैनिक ई-पेपर पढ़ें"
          >
            <Newspaper className="w-4 h-4 text-amber-400" />
            <span>ई-पेपर</span>
          </button>

          {/* Boxed Close Button [X] */}
          <button
            onClick={onClose}
            className="p-1.5 rounded border border-[#1a3d6f] bg-[#0b244d] hover:bg-[#12366e] text-blue-200 hover:text-white transition-colors cursor-pointer"
            title="मेन्यू बंद करें"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#0c2850] scrollbar-thin scrollbar-thumb-blue-900 scrollbar-track-[#071d41]">
          {menuList.map((item) => {
            const hasSub = item.subItems && item.subItems.length > 0;
            const isSubOpen = !!openSubMenus[item.id];

            return (
              <div key={item.id} className="w-full">
                <div
                  onClick={() => handleItemClick(item)}
                  className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-[#0c2a59] ${
                    item.isHighlighted
                      ? 'text-amber-400 font-extrabold'
                      : 'text-white font-bold'
                  }`}
                >
                  <span className="text-[15px] font-hindi-brand tracking-normal">
                    {item.title}
                  </span>

                  {hasSub && (
                    <button
                      type="button"
                      onClick={(e) => toggleSubMenu(item.id, e)}
                      className="p-1 text-blue-200 hover:text-white transition-colors"
                    >
                      {isSubOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Submenu Accordion */}
                {hasSub && isSubOpen && (
                  <div className="bg-[#05152e] py-1 border-t border-[#092248] border-b border-[#092248]">
                    {item.subItems?.map((sub, sIdx) => (
                      <div
                        key={sIdx}
                        onClick={() => handleSubItemClick(sub)}
                        className="px-6 py-2 text-xs sm:text-sm font-hindi-brand text-blue-100 hover:text-amber-300 hover:bg-[#09244f] cursor-pointer transition-colors flex items-center justify-between"
                      >
                        <span>{sub.title}</span>
                        <span className="text-[10px] text-blue-400 font-sans">›</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Drawer Footer */}
        <div className="p-3 bg-[#051631] border-t border-[#0e2c56] flex items-center justify-between text-[11px] text-blue-300 font-hindi-brand">
          <span>आज का प्रहरी (AKP News)</span>
          <span className="text-[10px] text-amber-400 font-mono">24x7 समाचार</span>
        </div>
      </div>
    </div>
  );
}
