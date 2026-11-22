import { z } from 'zod';

export const MAX_ARTICLES_LIMIT = 100;

export function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (!parsed.hostname) {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const optionalSafeHttpUrlSchema = (maxLen = 1000) =>
  z
    .string()
    .trim()
    .max(maxLen, `URL must not exceed ${maxLen} characters`)
    .refine((val) => val === '' || isSafeHttpUrl(val), {
      message: 'URL must be a valid http:// or https:// address',
    })
    .optional();

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'उपयोगकर्ता नाम आवश्यक है').max(100),
  password: z.string().min(1, 'पासवर्ड आवश्यक है').max(256),
});

export const bootstrapAdminSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'उपयोगकर्ता नाम कम से कम 3 अक्षरों का होना चाहिए')
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, 'उपयोगकर्ता नाम में केवल अक्षर, अंक, ., _, - मान्य हैं'),
  password: z
    .string()
    .min(8, 'सुरक्षा के लिए पासवर्ड कम से कम 8 अक्षरों का होना चाहिए')
    .max(256),
  name: z.string().trim().min(1).max(120).optional(),
});

export const createAdminUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may contain only letters, digits, ., _, -'),
  password: z.string().min(14, 'Password must be at least 14 characters').max(256),
  roleCode: z.enum(['chief_admin', 'senior_editor']),
  name: z.string().trim().min(1).max(120).optional(),
  avatar: optionalSafeHttpUrlSchema(500),
});

export const updateAdminUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'वर्तमान पासवर्ड आवश्यक है').max(256),
    newPassword: z
      .string()
      .min(14, 'नया पासवर्ड कम से कम 14 अक्षरों का होना चाहिए')
      .max(256, 'नया पासवर्ड 256 अक्षरों से अधिक नहीं हो सकता'),
    confirmPassword: z.string().min(1, 'नए पासवर्ड की पुष्टि आवश्यक है').max(256),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'नया पासवर्ड और पुष्टि पासवर्ड मेल नहीं खा रहे हैं',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'नया पासवर्ड वर्तमान पासवर्ड से भिन्न होना चाहिए',
    path: ['newPassword'],
  });

export const createArticleSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(400),
  slug: z.string().trim().max(400).optional(),
  summary: z.string().trim().max(2000).optional(),
  content: z.string().trim().min(1, 'Content is required').max(100000),
  category: z.string().trim().min(1, 'Category is required').max(100),
  subCategory: z.string().trim().max(120).optional(),
  author: z
    .object({
      name: z.string().trim().min(1).max(120),
      role: z.string().trim().max(120).optional().default('संवाददाता'),
      avatar: optionalSafeHttpUrlSchema(500).default(''),
      bio: z.string().trim().max(1000).optional(),
    })
    .optional(),
  publishedAt: z
    .string()
    .trim()
    .refine((val) => !Number.isNaN(Date.parse(val)), {
      message: 'publishedAt must be a valid ISO date string',
    })
    .optional(),
  readTime: z.string().trim().max(50).optional(),
  imageUrl: optionalSafeHttpUrlSchema(1000),
  imageCaption: z.string().trim().max(500).optional(),
  imagePhotographer: z.string().trim().max(200).optional(),
  isBreaking: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isEditorialPick: z.boolean().optional(),
  tags: z.union([z.array(z.string().trim().max(80)), z.string().max(500)]).optional(),
  status: z.enum(['published', 'draft', 'archived']).optional(),
  location: z.string().trim().max(120).optional(),
});

export const updateArticleSchema = createArticleSchema.partial();

export const createStateNewsSchema = z.object({
  state: z.enum(['दिल्ली', 'महाराष्ट्र', 'उत्तर प्रदेश', 'बिहार', 'पंजाब']),
  city: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1, 'Title is required').max(400),
  summary: z.string().trim().min(1, 'Summary is required').max(2000),
  content: z.string().trim().max(50000).optional(),
  imageUrl: optionalSafeHttpUrlSchema(1000),
  reporter: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().max(80)).optional(),
  isHeadline: z.boolean().optional(),
});

export const updateStateNewsSchema = createStateNewsSchema.partial();

export const createVideoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(400),
  description: z.string().trim().min(1, 'Description is required').max(5000),
  thumbnailUrl: optionalSafeHttpUrlSchema(1000),
  videoUrl: optionalSafeHttpUrlSchema(1000),
  duration: z.string().trim().max(40).optional(),
  category: z.string().trim().max(100).optional(),
  anchor: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(80).optional(),
  isLive: z.boolean().optional(),
});

export const updateVideoSchema = createVideoSchema.partial();

export const createEditorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: z.string().trim().min(1, 'Role is required').max(120),
  showName: z.string().trim().max(120).optional(),
  imageUrl: optionalSafeHttpUrlSchema(1000),
  bio: z.string().trim().max(2000).optional(),
  twitter: z.string().trim().max(100).optional(),
  experience: z.string().trim().max(100).optional(),
});

export const updateEditorSchema = createEditorSchema.partial();

export const createLiveUpdateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(400),
  content: z.string().trim().min(1, 'Content is required').max(5000),
  category: z.string().trim().max(100).optional(),
  isBreaking: z.boolean().optional(),
  author: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
});

export const aiEditorialAssistSchema = z.object({
  task: z.enum([
    'generate_headlines',
    'draft_article',
    'generate_summary',
    'polish_tone',
    'suggest_tags',
  ]),
  topic: z.string().trim().max(2000).optional(),
  existingText: z.string().trim().max(50000).optional(),
  category: z.string().trim().max(120).optional(),
  tone: z.string().trim().max(200).optional(),
  length: z.string().trim().max(120).optional(),
});

export const idParamSchema = z
  .string()
  .trim()
  .min(1, 'Invalid identifier')
  .max(200, 'Identifier too long')
  .refine(
    (val) => !/[\x00-\x1f\x7f/\\]/.test(val) && val !== '.' && val !== '..',
    'Invalid identifier characters'
  );

export const articlesQuerySchema = z.object({
  category: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(100).optional(),
  status: z
    .union([
      z.string().trim().max(50),
      z.array(z.string().trim().max(50)).max(10),
    ])
    .optional()
    .transform((val) => (typeof val === 'string' ? val : undefined)),
  featured: z.enum(['true', 'false']).optional(),
  breaking: z.enum(['true', 'false']).optional(),
  limit: z
    .string()
    .trim()
    .regex(/^\d+$/, 'limit must be a positive integer')
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val >= 1, 'limit must be at least 1')
    .transform((val) => Math.min(val, MAX_ARTICLES_LIMIT))
    .optional(),
  sort: z.enum(['publishedAt', 'title', 'category']).optional().default('publishedAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const stateNewsQuerySchema = z.object({
  state: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
});

export const videosQuerySchema = z.object({
  category: z.string().trim().max(100).optional(),
  anchor: z.string().trim().max(120).optional(),
  search: z.string().trim().max(200).optional(),
});
