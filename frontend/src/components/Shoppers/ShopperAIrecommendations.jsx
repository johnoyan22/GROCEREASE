import { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Image as ImageIcon,
  ArrowRight,
  Sparkles,
  Lightbulb,
  Package,
} from 'lucide-react';
import { askShopperAi, getShopperRecommendations } from '../../services/habelApi';

const SUGGESTIONS = ['Healthy Breakfast Idea', 'Ingredients for pasta', 'Snacks for kids'];
const INITIAL_VISIBLE = 5;

function formatPrice(value) {
  return `₱ ${Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ProductCard({ item, onAdd }) {
  return (
    <div className="border border-gray-300 rounded-xl p-2.5 flex flex-col justify-between items-center text-center bg-white">
      <div className="w-full h-24 flex items-center justify-center mb-2 rounded bg-gray-100">
        <Package className="w-8 h-8 text-gray-400" aria-hidden="true" />
      </div>
      <div className="w-full">
        <h3 className="text-xs font-bold text-black truncate" title={item.name}>{item.name}</h3>
        <p className="text-xs font-black text-black mt-0.5">{formatPrice(item.selling_price)}</p>
        {item.size && <p className="text-[10px] text-gray-500">{item.size}</p>}
        <p className="text-[10px] text-gray-500 mt-0.5 truncate" title={item.reason}>{item.reason}</p>
        <button
          type="button"
          onClick={() => onAdd(item, 1)}
          className="mt-2 w-full bg-green-100 text-[#006e00] text-[10px] font-bold py-1 rounded hover:bg-green-200 transition"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}

/**
 * Optional props (the Cart module can pass these in later):
 *   cartProductIds: number[]            product ids currently in the cart
 *   onAddToCart(item, quantity)         called when a shopper adds a recommendation
 */
export default function ShopperAIRecommendations({ cartProductIds = [], onAddToCart }) {
  const [activeTab, setActiveTab] = useState('ask');
  const [query, setQuery] = useState('');

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [enabled, setEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const [askResult, setAskResult] = useState(null);

  const [notice, setNotice] = useState('');
  const mounted = useRef(true);

  const cartKey = cartProductIds.join(',');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    getShopperRecommendations(cartProductIds)
      .then((response) => {
        if (!active) return;
        setItems(response.data ?? []);
        setEnabled(response.meta?.enabled !== false);
        setStatus('ready');
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(
          error.status === 403
            ? 'You do not have access to recommendations.'
            : 'Could not load recommendations. Please try again.',
        );
        setStatus('error');
      });

    return () => {
      active = false;
    };
    // cartKey represents cartProductIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, loadVersion]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  function handleAdd(item, quantity = 1) {
    if (typeof onAddToCart === 'function') {
      onAddToCart(item, quantity);
      setNotice(`${item.name} added to your cart.`);
    } else {
      setNotice('The cart is not connected to AI recommendations yet.');
    }
  }

  async function submitAsk(text) {
    const trimmed = text.trim();

    if (trimmed.length < 2) {
      setAskError('Type at least 2 characters.');
      return;
    }

    setAsking(true);
    setAskError('');

    try {
      const response = await askShopperAi(trimmed);
      if (!mounted.current) return;
      setAskResult({ ...response, query: trimmed });
    } catch (error) {
      if (!mounted.current) return;
      setAskError(
        error.status === 422
          ? Object.values(error.errors).flat()[0] || 'Please check your request.'
          : 'Could not get recommendations. Please try again.',
      );
    } finally {
      if (mounted.current) setAsking(false);
    }
  }

  function handlePillClick(text) {
    setQuery(text);
    setActiveTab('ask');
    submitAsk(text);
  }

  const visibleItems = showAll ? items : items.slice(0, INITIAL_VISIBLE);
  const askItems = askResult?.data?.items ?? [];
  const parsed = askResult?.data?.parsed;

  function askEmptyMessage() {
    if (askResult?.message) return askResult.message;
    if (askResult?.meta?.enabled === false) return 'AI recommendations are currently turned off.';
    if (askResult?.meta?.source === 'no_match') return 'No matching products are available right now.';
    return 'No items fit your request. Try a higher budget or different words.';
  }

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col font-sans">
      <main className="p-6 max-w-5xl">
        {/* Header Title */}
        <div className="mb-4">
          <h1 className="text-sm font-bold text-black">AI Recommendations</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Ask anything or upload an image to get personalized product recommendation.
          </p>
        </div>

        {notice && (
          <p role="status" className="mb-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-900">
            {notice}
          </p>
        )}

        {/* AI Prompt Container */}
        <div className="border border-gray-400 rounded-xl p-4 mb-6">
          <div className="flex gap-6 border-b border-gray-200 pb-2 mb-3">
            <button
              type="button"
              onClick={() => setActiveTab('ask')}
              className={`flex items-center gap-1.5 text-xs font-bold transition relative pb-1 ${activeTab === 'ask' ? 'text-black' : 'text-gray-500'}`}
            >
              <MessageSquare className="w-4 h-4" />
              Ask anything
              {activeTab === 'ask' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#006e00]"></span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 text-xs font-bold transition relative pb-1 ${activeTab === 'upload' ? 'text-black' : 'text-gray-500'}`}
            >
              <ImageIcon className="w-4 h-4" />
              Upload image
              {activeTab === 'upload' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#006e00]"></span>}
            </button>
          </div>

          {activeTab === 'ask' ? (
            <div className="border border-gray-300 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitAsk(query);
                  }}
                  maxLength={500}
                  placeholder="What are you looking for today?"
                  aria-label="What are you looking for today?"
                  className="w-full text-xs focus:outline-none text-gray-800 placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => submitAsk(query)}
                  disabled={asking}
                  aria-label="Get recommendations"
                  className="border border-gray-400 rounded p-1 hover:bg-gray-100 transition shrink-0 disabled:opacity-50"
                >
                  <ArrowRight className="w-4 h-4 text-gray-700" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4 text-[11px]">
                <span className="text-gray-600 font-medium">Try asking:</span>
                {SUGGESTIONS.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => handlePillClick(text)}
                    disabled={asking}
                    className="bg-green-200 text-green-900 px-2.5 py-0.5 rounded-full font-medium hover:bg-green-300 disabled:opacity-50"
                  >
                    {text}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[11px] text-gray-500">
                Tip: mention a budget or how many people, like &ldquo;pasta for 4 under 500&rdquo;.
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
              <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-2" aria-hidden="true" />
              <p className="text-xs font-bold text-black">Image recognition is not available yet</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Photo-based recommendations will be turned on once the AI service is configured.
                You can still use Ask anything.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('ask')}
                className="mt-3 text-xs font-bold text-[#006e00] hover:underline"
              >
                Go to Ask anything
              </button>
            </div>
          )}

          {asking && <p role="status" className="mt-3 text-xs text-gray-600">Finding products...</p>}
          {askError && <p role="alert" className="mt-3 text-xs text-red-600">{askError}</p>}
        </div>

        {/* Ask results */}
        {askResult && !asking && (
          <div className="mb-6 border border-green-300 bg-green-50/40 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h2 className="text-xs font-bold text-black">Results for &ldquo;{askResult.query}&rdquo;</h2>
              {parsed?.headcount && (
                <span className="text-[10px] bg-white border border-green-300 text-green-900 rounded-full px-2 py-0.5">
                  For {parsed.headcount} {parsed.headcount === 1 ? 'person' : 'people'}
                </span>
              )}
              {parsed?.budget && (
                <span className="text-[10px] bg-white border border-green-300 text-green-900 rounded-full px-2 py-0.5">
                  Budget {formatPrice(parsed.budget)}
                </span>
              )}
              {askResult.meta?.understanding === 'gemini' && (
                <span className="text-[10px] bg-white border border-blue-300 text-blue-900 rounded-full px-2 py-0.5">
                  Understood by AI
                </span>
              )}
            </div>

            {askItems.length === 0 ? (
              <p className="text-xs text-gray-600">{askEmptyMessage()}</p>
            ) : (
              <>
                <ul className="divide-y divide-green-100">
                  {askItems.map((item) => (
                    <li key={item.product_id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-black truncate">
                          {item.name}{item.size ? ` (${item.size})` : ''}
                        </p>
                        <p className="text-[11px] text-gray-600">
                          {item.quantity} &times; {formatPrice(item.selling_price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-black text-black">{formatPrice(item.line_total)}</span>
                        <button
                          type="button"
                          onClick={() => handleAdd(item, item.quantity)}
                          className="bg-green-100 text-[#006e00] text-[10px] font-bold px-3 py-1 rounded hover:bg-green-200 transition"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-right text-xs font-bold text-black">
                  Estimated total: {formatPrice(askResult.data.total)}
                </p>
              </>
            )}
          </div>
        )}

        {/* Recommendations Grid Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-500 mt-0.5" />
              <div>
                <h2 className="text-xs font-bold text-black">Recommendation for you</h2>
                <p className="text-[11px] text-gray-500">Based on your preferences and trends.</p>
              </div>
            </div>
            {items.length > INITIAL_VISIBLE && (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                className="text-xs font-bold text-[#006e00] hover:underline flex items-center gap-0.5"
              >
                {showAll ? 'Show less' : 'View All'} <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {status === 'loading' && (
            <p role="status" className="text-xs text-gray-600">Loading recommendations...</p>
          )}

          {status === 'error' && (
            <div>
              <p role="alert" className="text-xs text-red-600">{errorMessage}</p>
              <button
                type="button"
                onClick={() => {
                  setStatus('loading');
                  setLoadVersion((version) => version + 1);
                }}
                className="mt-2 rounded-lg bg-[#006e00] px-4 py-2 text-xs font-semibold text-white"
              >
                Retry
              </button>
            </div>
          )}

          {status === 'ready' && !enabled && (
            <p className="text-xs text-gray-600">AI recommendations are currently turned off.</p>
          )}

          {status === 'ready' && enabled && items.length === 0 && (
            <p className="text-xs text-gray-600">
              No recommendations are available right now. Check back after more products are in stock.
            </p>
          )}

          {status === 'ready' && enabled && items.length > 0 && (
            <div className="grid grid-cols-5 gap-3">
              {visibleItems.map((item) => (
                <ProductCard key={item.product_id} item={item} onAdd={handleAdd} />
              ))}
            </div>
          )}
        </div>

        {/* Tips Box */}
        <div className="border border-gray-400 rounded-xl p-4 flex items-start gap-2 bg-white">
          <Lightbulb className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-black">Tips for better Recommendations</h3>
            <p className="text-xs text-gray-600 mt-0.5">The more details you provide, the better we can recommend.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
