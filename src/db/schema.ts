import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

// ==========================================
// 1. EDITORIAL BOARD, ANCHORS & STAFF AUTHORS
// ==========================================
export const editors = pgTable(
  'editors',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    showName: text('show_name'),
    imageUrl: text('image_url').notNull(),
    bio: text('bio'),
    twitter: varchar('twitter', { length: 128 }),
    experience: varchar('experience', { length: 64 }),
    isStaffAuthorOnly: boolean('is_staff_author_only').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_editors_public_order').on(table.isStaffAuthorOnly, table.displayOrder),
  ]
);

// ==========================================
// 2. ADMIN USERS & PERSISTENT SESSIONS
// (PostgreSQL-backed custom auth foundation)
// ==========================================
export const adminUsers = pgTable(
  'admin_users',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    username: varchar('username', { length: 64 }).notNull(),
    email: varchar('email', { length: 254 }),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: varchar('role', { length: 64 }).notNull(),
    roleCode: varchar('role_code', { length: 24 }).notNull().default('editor'),
    avatar: text('avatar'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uniq_admin_users_username_lower').on(sql`lower(${table.username})`),
    uniqueIndex('uniq_admin_users_email_lower')
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} IS NOT NULL`),
  ]
);

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    adminUserId: varchar('admin_user_id', { length: 64 })
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_admin_sessions_user').on(table.adminUserId),
    index('idx_admin_sessions_expires').on(table.expiresAt),
  ]
);

// ==========================================
// 3. ARTICLES (मुख्य समाचार एवं संपादकीय)
// ==========================================
export const articles = pgTable(
  'articles',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    summary: text('summary').notNull(),
    content: text('content').notNull(),
    category: varchar('category', { length: 48 }).notNull(),
    subCategory: varchar('sub_category', { length: 64 }),
    authorId: varchar('author_id', { length: 64 }).references(() => editors.id, {
      onDelete: 'set null',
    }),
    authorName: text('author_name').notNull(),
    authorRole: text('author_role').notNull(),
    authorAvatar: text('author_avatar').notNull(),
    authorBio: text('author_bio'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    readTime: varchar('read_time', { length: 32 }).notNull(),
    imageUrl: text('image_url').notNull(),
    imageCaption: text('image_caption'),
    imagePhotographer: text('image_photographer'),
    isBreaking: boolean('is_breaking').notNull().default(false),
    isFeatured: boolean('is_featured').notNull().default(false),
    isEditorialPick: boolean('is_editorial_pick').notNull().default(false),
    isVideo: boolean('is_video').notNull().default(false),
    videoBadgeText: varchar('video_badge_text', { length: 64 }),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    views: integer('views').notNull().default(0),
    likes: integer('likes').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    status: varchar('status', { length: 16 }).notNull().default('published'),
    audioLength: varchar('audio_length', { length: 32 }),
    location: text('location'),
  },
  (table) => [
    index('idx_articles_status_published').on(table.status, table.publishedAt),
    index('idx_articles_category_published').on(table.category, table.publishedAt),
    index('idx_articles_breaking')
      .on(table.publishedAt)
      .where(sql`${table.isBreaking} = true`),
    index('idx_articles_featured')
      .on(table.publishedAt)
      .where(sql`${table.isFeatured} = true`),
    index('idx_articles_tags_gin').using('gin', table.tags),
  ]
);

// ==========================================
// 4. STATE NEWS (राज्यवार समाचार)
// ==========================================
export const stateNews = pgTable(
  'state_news',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    state: varchar('state', { length: 48 }).notNull(),
    city: text('city').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    content: text('content'),
    imageUrl: text('image_url').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    reporter: text('reporter').notNull(),
    readTime: varchar('read_time', { length: 32 }).notNull(),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isHeadline: boolean('is_headline').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_state_news_state_published').on(table.state, table.publishedAt),
    uniqueIndex('uniq_state_news_active_headline')
      .on(table.state)
      .where(sql`${table.isHeadline} = true`),
  ]
);

// ==========================================
// 5. VIDEO BULLETINS (वीडियो समाचार)
// ==========================================
export const videos = pgTable(
  'videos',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    thumbnailUrl: text('thumbnail_url').notNull(),
    videoUrl: text('video_url'),
    duration: varchar('duration', { length: 24 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    publishedLabel: text('published_label').notNull().default('अभी-अभी'),
    viewsCount: integer('views_count').notNull().default(0),
    viewsDisplay: varchar('views_display', { length: 24 }).notNull().default('0'),
    anchorId: varchar('anchor_id', { length: 64 }).references(() => editors.id, {
      onDelete: 'set null',
    }),
    anchor: text('anchor').notNull(),
    anchorAvatar: text('anchor_avatar'),
    isLive: boolean('is_live').notNull().default(false),
    tag: varchar('tag', { length: 64 }),
  },
  (table) => [
    index('idx_videos_category').on(table.category),
    index('idx_videos_published').on(table.publishedAt),
  ]
);

// ==========================================
// 6. LIVE UPDATES WIRE (ब्रेकिंग लाइव फीड)
// ==========================================
export const liveUpdates = pgTable(
  'live_updates',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    timestampLabel: varchar('timestamp_label', { length: 64 }).notNull().default('अभी-अभी'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    category: varchar('category', { length: 48 }).notNull(),
    isBreaking: boolean('is_breaking').notNull().default(false),
    author: text('author').notNull(),
    verified: boolean('verified').notNull().default(true),
    tag: varchar('tag', { length: 64 }),
    linkArticleId: varchar('link_article_id', { length: 80 }).references(() => articles.id, {
      onDelete: 'set null',
    }),
    location: text('location'),
  },
  (table) => [index('idx_live_updates_created').on(table.createdAt)]
);

// ==========================================
// 7. NEWSLETTERS, SUBSCRIBERS & BROADCASTS
// ==========================================
export const newsletters = pgTable('newsletters', {
  id: varchar('id', { length: 80 }).primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  schedule: text('schedule').notNull(),
  curator: text('curator').notNull(),
  icon: varchar('icon', { length: 32 }).notNull(),
  subscriberCount: integer('subscriber_count').notNull().default(0),
  badge: varchar('badge', { length: 48 }),
  sampleHeadline: text('sample_headline').notNull(),
  title: text('title'),
  deliveryTime: varchar('delivery_time', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subscribers = pgTable(
  'subscribers',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    email: varchar('email', { length: 254 }).notNull(),
    name: text('name'),
    frequency: varchar('frequency', { length: 24 }).notNull().default('daily'),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uniq_subscribers_email_lower').on(sql`lower(${table.email})`),
    index('idx_subscribers_status').on(table.status),
  ]
);

export const subscriberNewsletters = pgTable(
  'subscriber_newsletters',
  {
    subscriberId: varchar('subscriber_id', { length: 80 })
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    newsletterId: varchar('newsletter_id', { length: 80 })
      .notNull()
      .references(() => newsletters.id, { onDelete: 'cascade' }),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.subscriberId, table.newsletterId], name: 'pk_subscriber_newsletters' }),
    index('idx_subscriber_newsletters_nl').on(table.newsletterId),
  ]
);

export const newsletterBroadcasts = pgTable(
  'newsletter_broadcasts',
  {
    id: serial('id').primaryKey(),
    newsletterId: varchar('newsletter_id', { length: 80 }).references(() => newsletters.id, {
      onDelete: 'set null',
    }),
    subject: text('subject').notNull(),
    previewContent: text('preview_content'),
    recipientCount: integer('recipient_count').notNull().default(0),
    sentByAdminId: varchar('sent_by_admin_id', { length: 64 }).references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_newsletter_broadcasts_sent').on(table.sentAt)]
);

// ==========================================
// 8. COMMENTS (Supports Articles & State News)
// ==========================================
export const comments = pgTable(
  'comments',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    targetId: varchar('target_id', { length: 80 }).notNull(),
    articleId: varchar('article_id', { length: 80 }).references(() => articles.id, {
      onDelete: 'cascade',
    }),
    stateNewsId: varchar('state_news_id', { length: 80 }).references(() => stateNews.id, {
      onDelete: 'cascade',
    }),
    userName: text('user_name').notNull(),
    userAvatar: text('user_avatar'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    likes: integer('likes').notNull().default(0),
    status: varchar('status', { length: 16 }).notNull().default('approved'),
  },
  (table) => [
    index('idx_comments_target_created').on(table.targetId, table.createdAt),
    index('idx_comments_article').on(table.articleId),
    index('idx_comments_state_news').on(table.stateNewsId),
  ]
);

// ==========================================
// 9. READER POLLS ("आज का सवाल")
// ==========================================
export const polls = pgTable(
  'polls',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    question: text('question').notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    totalVotes: integer('total_votes').notNull().default(0),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_polls_active_created').on(table.isActive, table.createdAt)]
);

export const pollOptions = pgTable(
  'poll_options',
  {
    id: serial('id').primaryKey(),
    pollId: varchar('poll_id', { length: 80 })
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionKey: varchar('option_key', { length: 64 }).notNull(),
    text: text('text').notNull(),
    votes: integer('votes').notNull().default(0),
    percentage: integer('percentage').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('uniq_poll_options_poll_key').on(table.pollId, table.optionKey),
    index('idx_poll_options_poll_order').on(table.pollId, table.sortOrder),
  ]
);

export const pollVotes = pgTable(
  'poll_votes',
  {
    id: serial('id').primaryKey(),
    pollId: varchar('poll_id', { length: 80 })
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionId: integer('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    voterHash: varchar('voter_hash', { length: 128 }).notNull(),
    votedAt: timestamp('voted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uniq_poll_votes_poll_voter').on(table.pollId, table.voterHash),
    index('idx_poll_votes_option').on(table.optionId),
  ]
);

// ==========================================
// 10. AUDIT LOGS & MEDIA ASSETS
// ==========================================
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    method: varchar('method', { length: 16 }).notNull(),
    endpoint: varchar('endpoint', { length: 255 }).notNull(),
    details: text('details').notNull(),
    adminUserId: varchar('admin_user_id', { length: 64 }).references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    statusCode: integer('status_code'),
  },
  (table) => [index('idx_audit_logs_timestamp').on(table.timestamp)]
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    url: text('url').notNull(),
    mimeType: varchar('mime_type', { length: 64 }),
    caption: text('caption'),
    credit: text('credit'),
    uploadedByAdminId: varchar('uploaded_by_admin_id', { length: 64 }).references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_media_assets_created').on(table.createdAt)]
);

// ==========================================
// DRIZZLE RELATIONS
// ==========================================
export const editorsRelations = relations(editors, ({ many }) => ({
  articles: many(articles),
  videos: many(videos),
}));

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
  auditLogs: many(auditLogs),
  newsletterBroadcasts: many(newsletterBroadcasts),
  mediaAssets: many(mediaAssets),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [adminSessions.adminUserId],
    references: [adminUsers.id],
  }),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  authorProfile: one(editors, {
    fields: [articles.authorId],
    references: [editors.id],
  }),
  comments: many(comments),
  liveUpdates: many(liveUpdates),
}));

export const stateNewsRelations = relations(stateNews, ({ many }) => ({
  comments: many(comments),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  anchorProfile: one(editors, {
    fields: [videos.anchorId],
    references: [editors.id],
  }),
}));

export const liveUpdatesRelations = relations(liveUpdates, ({ one }) => ({
  linkedArticle: one(articles, {
    fields: [liveUpdates.linkArticleId],
    references: [articles.id],
  }),
}));

export const newslettersRelations = relations(newsletters, ({ many }) => ({
  subscriberLinks: many(subscriberNewsletters),
  broadcasts: many(newsletterBroadcasts),
}));

export const subscribersRelations = relations(subscribers, ({ many }) => ({
  newsletterLinks: many(subscriberNewsletters),
}));

export const subscriberNewslettersRelations = relations(subscriberNewsletters, ({ one }) => ({
  subscriber: one(subscribers, {
    fields: [subscriberNewsletters.subscriberId],
    references: [subscribers.id],
  }),
  newsletter: one(newsletters, {
    fields: [subscriberNewsletters.newsletterId],
    references: [newsletters.id],
  }),
}));

export const newsletterBroadcastsRelations = relations(newsletterBroadcasts, ({ one }) => ({
  newsletter: one(newsletters, {
    fields: [newsletterBroadcasts.newsletterId],
    references: [newsletters.id],
  }),
  sentByAdmin: one(adminUsers, {
    fields: [newsletterBroadcasts.sentByAdminId],
    references: [adminUsers.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  article: one(articles, {
    fields: [comments.articleId],
    references: [articles.id],
  }),
  stateNewsItem: one(stateNews, {
    fields: [comments.stateNewsId],
    references: [stateNews.id],
  }),
}));

export const pollsRelations = relations(polls, ({ many }) => ({
  options: many(pollOptions),
  votes: many(pollVotes),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  poll: one(polls, {
    fields: [pollOptions.pollId],
    references: [polls.id],
  }),
  voteRecords: many(pollVotes),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  poll: one(polls, {
    fields: [pollVotes.pollId],
    references: [polls.id],
  }),
  option: one(pollOptions, {
    fields: [pollVotes.optionId],
    references: [pollOptions.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [auditLogs.adminUserId],
    references: [adminUsers.id],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  uploadedByAdmin: one(adminUsers, {
    fields: [mediaAssets.uploadedByAdminId],
    references: [adminUsers.id],
  }),
}));
