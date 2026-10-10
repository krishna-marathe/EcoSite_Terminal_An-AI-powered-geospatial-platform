import React, { useEffect, useState } from 'react';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { apiClient } from '../../services/api';

interface NewsItem { title: string; url: string; source: string; publishedAt: string; summary?: string; dataStatus?: string }

export const PolicyNewsPanel: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const loadNews = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<NewsItem[]>('/news', { params: { q: 'environmental policy climate regulation India', limit: 8 } });
      setItems(response.data);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadNews(); }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0F172A]/90 text-xs">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#1E293B] bg-[#111A2E] px-3.5">
        <div className="flex items-center gap-2"><Newspaper className="h-4 w-4 text-emerald-300" /><span className="font-semibold text-slate-100">Policy & Environmental News</span><span className="rounded border border-emerald-400/20 bg-emerald-950/30 px-1.5 py-0.5 text-[10px] text-emerald-200">INTERNET</span></div>
        <button type="button" onClick={() => void loadNews()} className="text-slate-500 hover:text-emerald-300" title="Refresh news"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-[#1E293B]/60">
        {loading && <div className="p-3 text-slate-500">Loading attributed policy headlines…</div>}
        {!loading && unavailable && <div className="p-3 text-amber-200">Internet news is unavailable. Start the Python backend and verify outbound feed access.</div>}
        {!loading && !unavailable && items.map((item) => <a key={`${item.url}-${item.publishedAt}`} href={item.url} target="_blank" rel="noreferrer" className="block space-y-1 p-3 hover:bg-[#15233D]"><div className="flex items-start gap-2"><span className="flex-1 font-medium leading-snug text-slate-200">{item.title}</span><ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" /></div><div className="flex items-center justify-between text-[10px] text-slate-500"><span>{item.source}</span><span>{item.publishedAt}</span></div></a>)}
      </div>
      <div className="border-t border-[#1E293B] px-3 py-2 text-[10px] text-slate-500">Headlines are links to external publishers. Validate source context before making a compliance decision.</div>
    </div>
  );
};
