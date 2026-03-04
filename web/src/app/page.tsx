'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, CreditCard, X, ChevronDown, Star, AlertCircle, Clock, LogIn, LogOut, ExternalLink } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';

function isEmbeddedBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /LinkedIn|FBAN|FBAV|Instagram|Twitter|Line\/|MicroMessenger|WebView|(iPhone|iPod|iPad)(?!.*Safari)/i.test(ua);
}

interface Card {
  id: number;
  name: string;
  issuer: string;
  base_rate: number;
  reward_type: string;
  points_value: number;
  color: string;
}

interface Recommendation {
  cardId: number;
  cardName: string;
  issuer: string;
  color: string;
  rate: number;
  effectiveRate: number;
  benefitType: string;
  rewardType: string;
  category: string | null;
  notes: string | null;
  spendCap: number | null;
  capPeriod: string | null;
  requiresActivation: boolean;
  validUntil: string | null;
  isRotating: boolean;
  baseRate: number;
  benefitsUrl: string | null;
}

interface MerchantMatch {
  merchantId: number | null;
  merchantName: string;
  categoryId: number | null;
  categoryName: string | null;
  isOnline: boolean;
}

interface Merchant {
  id: number;
  name: string;
  domain: string;
  category_name: string;
  category_icon: string;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [cardSearch, setCardSearch] = useState('');
  const [showCardDropdown, setShowCardDropdown] = useState(false);
  const [merchantQuery, setMerchantQuery] = useState('');
  const [merchantSuggestions, setMerchantSuggestions] = useState<Merchant[]>([]);
  const [showMerchantDropdown, setShowMerchantDropdown] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [merchantMatch, setMerchantMatch] = useState<MerchantMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [embeddedBrowser, setEmbeddedBrowser] = useState(false);
  const [allCategories, setAllCategories] = useState<{ id: number; name: string; icon: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const merchantRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEmbeddedBrowser(isEmbeddedBrowser());
  }, []);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setAllCategories).catch(() => {});
  }, []);

  // Load all cards
  useEffect(() => {
    fetch('/api/cards').then(r => r.json()).then(setAllCards);
  }, []);

  // Load saved cards when signed in
  useEffect(() => {
    if (session?.user) {
      fetch('/api/user/cards').then(r => r.json()).then((saved: Card[]) => {
        if (Array.isArray(saved) && saved.length > 0) setSelectedCards(saved);
      });
    }
  }, [session]);

  // Merchant autocomplete
  useEffect(() => {
    if (merchantQuery.length < 1) { setMerchantSuggestions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/merchants?q=${encodeURIComponent(merchantQuery)}`)
        .then(r => r.json()).then(setMerchantSuggestions);
    }, 200);
    return () => clearTimeout(t);
  }, [merchantQuery]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (merchantRef.current && !merchantRef.current.contains(e.target as Node)) setShowMerchantDropdown(false);
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setShowCardDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredCards = allCards.filter(c =>
    !selectedCards.find(s => s.id === c.id) &&
    (c.name.toLowerCase().includes(cardSearch.toLowerCase()) ||
     c.issuer.toLowerCase().includes(cardSearch.toLowerCase()))
  );

  const addCard = async (card: Card) => {
    setSelectedCards(p => [...p, card]);
    setCardSearch('');
    setShowCardDropdown(false);
    if (session?.user) {
      await fetch('/api/user/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id }),
      });
    }
  };

  const removeCard = async (id: number) => {
    setSelectedCards(p => p.filter(c => c.id !== id));
    setRecommendations(null);
    if (session?.user) {
      await fetch('/api/user/cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: id }),
      });
    }
  };

  const getRecommendations = async (overrideCategoryId?: number | null) => {
    if (!merchantQuery || selectedCards.length === 0) return;
    setLoading(true);
    setShowCategoryPicker(false);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardIds: selectedCards.map(c => c.id),
          merchant: merchantQuery,
          categoryId: overrideCategoryId ?? selectedCategoryId ?? undefined,
        }),
      });
      const data = await res.json();
      setRecommendations(data.recommendations);
      setMerchantMatch(data.merchant);
      // If merchant not found in DB, prompt for category (unless already provided)
      if (!data.merchant.merchantId && overrideCategoryId == null && !selectedCategoryId) {
        setShowCategoryPicker(true);
        setRecommendations(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatReward = (rec: Recommendation) => {
    if (rec.rewardType === 'points') return `${rec.rate}x points`;
    return `${rec.rate}% cash back`;
  };

  const formatEffectiveValue = (rec: Recommendation) => {
    if (rec.rewardType !== 'points') return null;
    const effective = rec.effectiveRate.toFixed(1).replace(/\.0$/, '');
    return `~${effective}% value`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div className="flex-1 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-500/20 rounded-2xl mb-4">
              <CreditCard className="w-7 h-7 text-indigo-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2">💳 Pick The Best Card</h1>
            <p className="text-slate-400 text-sm">Find the best card to use at any store</p>
          </div>

          {/* Auth button */}
          <div className="absolute top-8 right-8">
            {status === 'loading' ? null : session ? (
              <div className="flex items-center gap-3">
                {session.user?.image && (
                  <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
                )}
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium">{session.user?.name?.split(' ')[0]}</div>
                  <button
                    onClick={() => signOut()}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" /> Sign out
                  </button>
                </div>
              </div>
            ) : embeddedBrowser ? (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-sm font-medium text-amber-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in browser to sign in
                </a>
              ) : (
                <button
                  onClick={() => signIn('google')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm font-medium transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in with Google
                </button>
              )}
          </div>
        </div>

        {/* Signed-in save banner */}
        {!session && status !== 'loading' && (
          <div className={`mb-6 flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${embeddedBrowser ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'}`}>
            {embeddedBrowser ? (
              <>
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>
                  Google sign-in doesn&apos;t work in in-app browsers.{' '}
                  <a href={typeof window !== 'undefined' ? window.location.href : '/'} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    Open in Chrome or Safari
                  </a>{' '}
                  to sign in and save your cards.
                </span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 shrink-0" />
                <span>
                  <button onClick={() => signIn('google')} className="underline font-medium">Sign in with Google</button>
                  {' '}to save your wallet — no more re-entering cards each time.
                </span>
              </>
            )}
          </div>
        )}

        {/* Card selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Your Cards
            {session && <span className="ml-2 text-xs text-indigo-400 font-normal">✓ saved to your account</span>}
          </label>

          {selectedCards.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedCards.map(card => (
                <div
                  key={card.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: card.color + '33', borderWidth: 1, borderColor: card.color + '66' }}
                >
                  <span style={{ color: card.color }}>●</span>
                  <span>{card.name}</span>
                  <button onClick={() => removeCard(card.id)} className="ml-1 opacity-60 hover:opacity-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div ref={cardRef} className="relative">
            <div
              className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 cursor-text"
              onClick={() => setShowCardDropdown(true)}
            >
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                className="bg-transparent outline-none text-sm w-full placeholder-slate-500"
                placeholder="Add a card (e.g. Chase Sapphire, Amex Gold...)"
                value={cardSearch}
                onChange={e => { setCardSearch(e.target.value); setShowCardDropdown(true); }}
                onFocus={() => setShowCardDropdown(true)}
              />
              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
            </div>

            {showCardDropdown && (
              <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-10 max-h-64 overflow-y-auto">
                {filteredCards.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">No cards found</div>
                ) : (
                  filteredCards.map(card => (
                    <button
                      key={card.id}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-left transition-colors"
                      onClick={() => addCard(card)}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: card.color }} />
                      <div>
                        <div className="text-sm font-medium">{card.name}</div>
                        <div className="text-xs text-slate-400">{card.issuer} · {card.base_rate}% base</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Merchant input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Where are you shopping?</label>
          <div ref={merchantRef} className="relative">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                className="bg-transparent outline-none text-sm w-full placeholder-slate-500"
                placeholder="e.g. Amazon, Costco, Nike, Starbucks..."
                value={merchantQuery}
                onChange={e => { setMerchantQuery(e.target.value); setShowMerchantDropdown(true); setRecommendations(null); setShowCategoryPicker(false); setSelectedCategoryId(null); }}
                onFocus={() => setShowMerchantDropdown(true)}
                onKeyDown={e => { if (e.key === 'Enter') { setShowMerchantDropdown(false); getRecommendations(); } }}
              />
            </div>

            {showMerchantDropdown && merchantSuggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-10">
                {merchantSuggestions.map((m: Merchant) => (
                  <button
                    key={m.id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-left transition-colors"
                    onClick={() => { setMerchantQuery(m.name); setShowMerchantDropdown(false); }}
                  >
                    <span className="text-lg">{m.category_icon}</span>
                    <div>
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-slate-400">{m.category_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Find button */}
        <button
          onClick={() => getRecommendations()}
          disabled={!merchantQuery || selectedCards.length === 0 || loading}
          className="w-full py-3.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Checking...' : 'Find Best Card'}
        </button>

        {/* Category picker for unknown merchants */}
        {showCategoryPicker && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-800/70 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-sm text-slate-300">
                We don&apos;t recognize <span className="text-white font-medium">{merchantQuery}</span> yet.
                What type of store is it?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    getRecommendations(cat.id);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-sm transition-colors text-left"
                >
                  <span>{cat.icon}</span>
                  <span className="text-slate-200">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {recommendations && (
          <div className="mt-8 space-y-3">
            <div className="text-sm text-slate-400 mb-4">
              Best cards for <span className="text-white font-medium">{merchantMatch?.merchantName}</span>
              {merchantMatch?.categoryName && (
                <span className="text-slate-500"> · {merchantMatch.categoryName}</span>
              )}
            </div>

            {recommendations.map((rec, idx) => (
              <div
                key={rec.cardId}
                className={`relative rounded-2xl p-4 border transition-all ${
                  idx === 0
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                {idx === 0 && (
                  <div className="absolute -top-2.5 left-4 flex items-center gap-1 bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3" />
                    Best Choice
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: rec.color + '22', borderWidth: 1, borderColor: rec.color + '44' }}
                    >
                      <CreditCard className="w-5 h-5" style={{ color: rec.color }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{rec.cardName}</div>
                      <div className="text-xs text-slate-400">{rec.issuer}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold" style={{ color: idx === 0 ? '#818cf8' : '#94a3b8' }}>
                      {formatReward(rec)}
                    </div>
                    {formatEffectiveValue(rec) && (
                      <div className="text-xs font-medium text-emerald-400">{formatEffectiveValue(rec)}</div>
                    )}
                    {rec.category && (
                      <div className="text-xs text-slate-500">{rec.category}</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  {rec.requiresActivation && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Requires activation on card issuer's website
                    </div>
                  )}
                  {rec.isRotating && rec.validUntil && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-400">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Rotating bonus — valid until {new Date(rec.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  {rec.spendCap && (
                    <div className="text-xs text-slate-500">
                      💡 ${rec.spendCap.toLocaleString()} {rec.capPeriod}ly spend cap on bonus rate
                    </div>
                  )}
                  {rec.notes && (
                    <div className="text-xs text-slate-500">ℹ️ {rec.notes}</div>
                  )}
                  {rec.benefitsUrl && (
                    <a
                      href={rec.benefitsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-400 transition-colors mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {rec.isRotating ? 'View rotating category calendar' : 'View card benefits'}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {recommendations && recommendations.length > 0 && recommendations.some(r => r.rewardType === 'points') && (
          <div className="mt-4 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-500">
            💡 Points value estimated using industry-standard valuations (Chase UR: 2¢, Amex MR: 2¢, Capital One: 1.85¢). Actual value varies by redemption method.
          </div>
        )}

        {recommendations?.length === 0 && (
          <div className="mt-8 text-center text-slate-500 text-sm">
            No matching benefits found. Try a different store name or category.
          </div>
        )}

        <p className="text-center text-xs text-slate-600 mt-10">
          Card benefits are updated periodically. Always verify with your card issuer.
        </p>
      </div>
    </div>
  );
}
