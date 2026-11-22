import { Article, LiveUpdate } from '../../src/types';

/**
 * Centralized, fail-closed public visibility predicate for news articles.
 * Only articles with explicit status === 'published' and a valid, non-future
 * publishedAt timestamp are considered publicly visible.
 */
export function isArticlePubliclyVisible(
  article: Partial<Article> | Record<string, any> | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!article || typeof article !== 'object') {
    return false;
  }

  if (typeof article.status !== 'string' || article.status.trim().toLowerCase() !== 'published') {
    return false;
  }

  // Fail closed when publication timestamp is missing, empty, malformed, or in the future
  if (typeof article.publishedAt !== 'string' || article.publishedAt.trim().length === 0) {
    return false;
  }

  const publishedMs = Date.parse(article.publishedAt);
  if (Number.isNaN(publishedMs) || publishedMs > nowMs) {
    return false;
  }

  return true;
}

/**
 * Returns a new array containing only publicly visible articles.
 * Must be applied BEFORE search, category/tag filtering, sorting, counting, or pagination.
 */
export function filterPublicArticles<T extends Partial<Article>>(
  articles: readonly T[],
  nowMs: number = Date.now()
): T[] {
  if (!Array.isArray(articles)) {
    return [];
  }
  return articles.filter((article) => isArticlePubliclyVisible(article, nowMs));
}

/**
 * Finds an article by ID or slug ONLY if it is publicly visible.
 * Returns null for drafts, archived, scheduled, unpublished, private, missing-status,
 * invalid-date, or nonexistent articles so callers return a uniform 404 response.
 */
export function findPublicArticleByIdOrSlug<T extends Partial<Article>>(
  articles: readonly T[],
  idOrSlug: string,
  nowMs: number = Date.now()
): T | null {
  if (!Array.isArray(articles) || !idOrSlug) {
    return null;
  }
  const article = articles.find((a) => a.id === idOrSlug || a.slug === idOrSlug);
  if (!article || !isArticlePubliclyVisible(article, nowMs)) {
    return null;
  }
  return article;
}

/**
 * Filters live updates for unauthenticated public delivery so dispatches linked
 * to non-public/draft/archived/scheduled/orphaned articles cannot leak or leave broken links.
 */
export function filterPublicLiveUpdates(
  liveUpdates: readonly LiveUpdate[],
  articles: readonly Partial<Article>[],
  nowMs: number = Date.now()
): LiveUpdate[] {
  if (!Array.isArray(liveUpdates)) {
    return [];
  }

  const articleById = new Map<string, Partial<Article>>();
  if (Array.isArray(articles)) {
    for (const article of articles) {
      if (article?.id) {
        articleById.set(article.id, article);
      }
    }
  }

  return liveUpdates.filter((update) => {
    const linkId = typeof update.linkArticleId === 'string' ? update.linkArticleId.trim() : '';
    if (!linkId) {
      return true;
    }
    const linked = articleById.get(linkId);
    if (!linked) {
      return false;
    }
    return isArticlePubliclyVisible(linked, nowMs);
  });
}
