import { apiClient } from './api';

export type NewsRegion = 'india' | 'world';
export type NewsCoverage = 'FRESH' | 'STALE' | 'NOT_COVERED' | 'NOT_CONFIGURED' | 'UNAVAILABLE';

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  summary?: string | null;
  region: NewsRegion;
  topics: string[];
  provider: string;
  mediaClass: 'MEDIA_REPORT';
  retrievedAt: string;
}

export interface NewsFeed {
  region: NewsRegion;
  topic: string;
  generatedAt: string;
  coverage: NewsCoverage;
  provider: string;
  items: NewsItem[];
}

export interface NewsTopic {
  key: string;
  label: string;
}

export interface NewsTopics {
  regions: NewsRegion[];
  topics: NewsTopic[];
  catalogueVersion: string;
}

const COVERAGE: NewsCoverage[] = ['FRESH', 'STALE', 'NOT_COVERED', 'NOT_CONFIGURED', 'UNAVAILABLE'];

function isNewsItem(value: unknown): value is NewsItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<NewsItem>;
  return Boolean(
    typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.url === 'string' &&
      /^https?:\/\//.test(item.url) &&
      typeof item.publisher === 'string' &&
      typeof item.publishedAt === 'string' &&
      item.mediaClass === 'MEDIA_REPORT'
  );
}

export async function getNewsFeed(region: NewsRegion, topic: string, limit = 8): Promise<NewsFeed> {
  const response = await apiClient.get<unknown>('/news/feed', { params: { region, topic, limit } });
  const value = response.data as Partial<NewsFeed> | null;
  if (
    !value ||
    (value.region !== 'india' && value.region !== 'world') ||
    typeof value.topic !== 'string' ||
    typeof value.generatedAt !== 'string' ||
    typeof value.provider !== 'string' ||
    !Array.isArray(value.items) ||
    !value.items.every(isNewsItem) ||
    !COVERAGE.includes(value.coverage as NewsCoverage)
  ) {
    throw new Error('The news feed returned an invalid response.');
  }
  return value as NewsFeed;
}

export async function getNewsTopics(): Promise<NewsTopics> {
  const response = await apiClient.get<unknown>('/news/topics');
  const value = response.data as Partial<NewsTopics> | null;
  if (
    !value ||
    !Array.isArray(value.topics) ||
    !value.topics.every((topic) => topic && typeof topic.key === 'string' && typeof topic.label === 'string') ||
    typeof value.catalogueVersion !== 'string'
  ) {
    throw new Error('The news topic catalogue returned an invalid response.');
  }
  return value as NewsTopics;
}
