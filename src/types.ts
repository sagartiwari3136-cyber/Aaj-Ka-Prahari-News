export type Category =
  | 'ताज़ातरीन'
  | 'देश'
  | 'शहर'
  | 'क्रिकेट'
  | 'मनोरंजन'
  | 'कारोबार'
  | 'विदेश'
  | 'तकनीक'
  | 'संपादकीय'
  | 'लाइफस्टाइल'
  | 'All';

export type Edition = 'राष्ट्रीय' | 'उत्तर प्रदेश' | 'दिल्ली-NCR' | 'मुंबई' | 'ग्लोबल';

export interface Author {
  name: string;
  role: string;
  avatar: string;
  bio?: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: Category;
  subCategory?: string;
  author: Author;
  publishedAt: string;
  updatedAt?: string;
  readTime: string;
  imageUrl: string;
  imageCaption?: string;
  imagePhotographer?: string;
  isBreaking?: boolean;
  isFeatured?: boolean;
  isEditorialPick?: boolean;
  isVideo?: boolean;
  videoBadgeText?: string;
  tags: string[];
  status: 'published' | 'draft' | 'archived';
  audioLength?: string;
  location?: string;
}

export interface LiveUpdate {
  id: string;
  timestamp: string;
  title: string;
  content: string;
  category: string;
  isBreaking: boolean;
  author: string;
  verified: boolean;
  tag?: string;
  linkArticleId?: string;
  location?: string;
}

export type MajorState = 'दिल्ली' | 'महाराष्ट्र' | 'उत्तर प्रदेश' | 'बिहार' | 'पंजाब';

export interface StateNewsItem {
  id: string;
  state: MajorState;
  city: string;
  title: string;
  summary: string;
  content?: string;
  imageUrl: string;
  publishedAt: string;
  reporter: string;
  readTime: string;
  tags: string[];
  isHeadline?: boolean;
}

export interface VideoNewsItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl?: string;
  duration: string;
  category: string;
  publishedAt: string;
  anchor: string;
  anchorAvatar?: string;
  isLive?: boolean;
  tag?: string;
}

export interface EditorAnchor {
  id: string;
  name: string;
  role: string;
  showName?: string;
  imageUrl: string;
  bio?: string;
  twitter?: string;
  experience?: string;
}

export interface MarketTickerItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

export interface AnalyticsDashboard {
  totalArticles: number;
  totalVideos: number;
  totalStateNews: number;
  categoryBreakdown: Record<string, number>;
  stateBreakdown: Record<string, number>;
  recentArticles: { id: string; title: string; publishedAt: string; category: string }[];
  systemHealth: {
    status: 'healthy' | 'degraded';
    uptimeSeconds: number;
    memoryUsageMb: number;
    databaseEntries: number;
    lastSavedAt: string;
  };
}
