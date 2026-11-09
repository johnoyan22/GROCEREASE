import { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Image as ImageIcon,
  ArrowRight,
  Sparkles,
  Lightbulb,
  Package,
} from 'lucide-react';
import {
  askShopperAi,
  askShopperAiWithImage,
  getProductAlternatives,
  getShopperRecommendations,
} from '../../services/habelApi';

const SUGGESTIONS = ['Ingredients for spaghetti under ₱500', 'Breakfast for 4 people', 'Affordable snacks'];
const INITIAL_VISIBLE = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function formatPrice(value) {
  return `₱ ${Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function imageErrorMessage(error) {
  if (error.status === 422) {
    return Object.values(error.errors ?? {}).flat()[0] || 'Please check your photo.';
  }
  if (error.status === 429) {
    return 'Too many photo requests. Please wait a minute and try again.';
  }
  if (error.status === 503) {
    return error.message;
  }
  return 'Could not read the photo. Please try again.';
}

function ProductCard({ item, onAdd, onAlternatives }) {
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
        <p className="mt-1 text-[10px] text-gray-500">Available: {item.available_stock} · Limit/order: {item.max_per_order ?? 'No extra limit'}</p>
        <button
          type="button"
          onClick={() => onAdd(item, 1)}
          className="mt-2 w-full bg-green-100 text-[#006e00] text-[10px] font-bold py-1 rounded hover:bg-green-200 transition"
        >
          Add to Cart
        </button>
        <button type="button" onClick={() => onAlternatives(item)} className="mt-2 text-xs text-green-800 underline">View alternatives</button>
      </div>
    </div>
  );
}

// The account-keyed workspace owns the only cart. Store/catalog changes remount this view.
export default function ShopperAIRecommendations({ shopping, onAddToCart, onSelectStore, onViewCart }) {
  if (!shopping.storeId) return <main className="p-6"><h1 className="text-xl font-bold">AI Recommendations</h1><p className="my-4">Select a supermarket before requesting recommendations.</p><button onClick={onSelectStore} className="rounded bg-green-700 px-4 py-2 text-white">Choose supermarket</button></main>;
  if (shopping.catalog.loading || shopping.locked) return <p role="status" className="p-6">Loading your selected supermarket and cart...</p>;
  if (shopping.catalog.error) return <main className="p-6"><p role="alert">{shopping.catalog.error}</p><button onClick={shopping.refresh}>Refresh products</button></main>;
  const signature = JSON.stringify(shopping.catalog.products.map(p => [p.store_inventory_id, p.selling_price, p.available_stock, p.max_per_order]));
  return <StoreAiRecommendations key={shopping.storeId + signature} storeId={shopping.storeId} storeName={shopping.catalog.store?.store_name}
    cartInventoryIds={shopping.cart.items.map(item => item.store_inventory_id)} onAddToCart={onAddToCart} onViewCart={onViewCart} onSelectStore={onSelectStore} />;
}

function StoreAiRecommendations({ storeId, storeName, cartInventoryIds, onAddToCart, onViewCart, onSelectStore }) {
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

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageNote, setImageNote] = useState('');

  const [notice, setNotice] = useState('');
  const mounted = useRef(true);
  const requestController = useRef(null);
  const alternativeController = useRef(null);
  const [consent, setConsent] = useState(false);
  const [alternatives, setAlternatives] = useState(null);
  const [alternativeError, setAlternativeError] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  const cartKey = cartInventoryIds.join(',');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestController.current?.abort();
      alternativeController.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    getShopperRecommendations(storeId, cartInventoryIds, { signal: controller.signal })
      .then((response) => {
        if (!active) return;
        if (response.store_id !== storeId) throw new Error('Your supermarket changed. Refresh products.');
        setItems(response.data ?? []);
        setEnabled(response.meta?.enabled !== false);
        setStatus('ready');
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(
          error.status === 403
            ? 'You do not have access to recommendations.'
            : error.message || 'Could not load recommendations. Please try again.',
        );
        setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
    // cartKey represents the inventory identities in cartInventoryIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, cartKey, loadVersion]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Free the preview URL when the photo changes or the page closes.
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  async function handleAdd(item, quantity = 1) {
    if (addBusy) return;
    setAddBusy(true); setNotice('Checking current price and stock...');
    try {
      await onAddToCart(item, quantity);
      if (mounted.current) setNotice(item.name + ' added to your cart.');
    } catch (error) { if (mounted.current) setNotice(error.message); }
    finally { if (mounted.current) setAddBusy(false); }
  }

  async function loadAlternatives(item) {
    alternativeController.current?.abort();
    const controller = new AbortController(); alternativeController.current = controller;
    setAlternatives(null); setAlternativeError('');
    try {
      const result = await getProductAlternatives(storeId, item.store_inventory_id, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      if (result.store_id !== storeId) throw new Error('Your supermarket changed. Refresh products.');
      setAlternatives({ name: item.name, items: result.data, enabled: result.meta?.alternatives_enabled });
    } catch (error) { if (mounted.current && error.name !== 'AbortError') setAlternativeError(error.message); }
  }

  async function submitAsk(text) {
    const trimmed = text.trim();

    if (trimmed.length < 2) {
      setAskError('Type at least 2 characters.');
      return;
    }

    requestController.current?.abort();
    const controller = new AbortController(); requestController.current = controller;
    setAsking(true);
    setAskError('');

    try {
      const response = await askShopperAi(storeId, trimmed, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      if (response.store_id !== storeId) throw new Error('Your supermarket changed. Refresh products.');
      setAskResult({ ...response, query: trimmed, kind: 'text' });
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      setAskError(
        error.status === 422
          ? Object.values(error.errors).flat()[0] || 'Please check your request.'
          : error.message || 'Could not get recommendations. Please try again.',
      );
    } finally {
      if (mounted.current && !controller.signal.aborted) setAsking(false);
    }
  }

  function handlePillClick(text) {
    setQuery(text);
    setActiveTab('ask');
    submitAsk(text);
  }

  function chooseImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!IMAGE_TYPES.includes(file.type)) {
      setAskError('Please choose a JPG, PNG or WebP photo.');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setAskError('That photo is larger than 4 MB. Please choose a smaller one.');
      return;
    }

    setAskError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview('');
    setAskError('');
  }

  async function submitImage() {
    if (!consent) { setAskError('Confirm that you agree to send this photo to Gemini.'); return; }
    if (!imageFile) {
      setAskError('Choose a photo first.');
      return;
    }

    requestController.current?.abort();
    const controller = new AbortController(); requestController.current = controller;
    setAsking(true);
    setAskError('');

    try {
      const response = await askShopperAiWithImage(storeId, imageFile, imageNote.trim(), { signal: controller.signal, consent });
      if (!mounted.current || controller.signal.aborted) return;
      if (response.store_id !== storeId) throw new Error('Your supermarket changed. Refresh products.');
      setAskResult({ ...response, query: 'your photo', kind: 'image' });
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      setAskError(imageErrorMessage(error));
    } finally {
      if (mounted.current && !controller.signal.aborted) setAsking(false);
    }
  }

  const visibleItems = showAll ? items : items.slice(0, INITIAL_VISIBLE);
  const askItems = askResult?.data?.items ?? [];
  const parsed = askResult?.data?.parsed;
  const detected = askResult?.data?.detected ?? [];

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
            Products from {storeName}. Ask for ideas or upload a grocery photo.
          </p>
        </div>

        <div className="flex gap-4 mb-4 text-xs text-green-800"><button onClick={onSelectStore} className="underline">Change supermarket</button><button onClick={onViewCart} className="underline">View My Cart</button><button onClick={() => { setAskResult(null); setAlternatives(null); setStatus('loading'); setLoadVersion(v => v + 1); }} className="underline">Refresh recommendations</button></div>
        {notice && (
          <p role="status" className="mb-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-900">
            {notice}
          </p>
        )}

        <fieldset disabled={addBusy} className="border-0 p-0 m-0">
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
                  disabled={asking || !enabled}
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
            <div className="border border-gray-300 rounded-lg p-4">
              {!imageFile ? (
                <label className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-gray-300 p-6 text-center hover:bg-gray-50 focus-within:ring-2 focus-within:ring-green-600">
                  <ImageIcon className="w-6 h-6 text-gray-400 mb-2" aria-hidden="true" />
                  <span className="text-xs font-bold text-black">Choose a photo</span>
                  <span className="text-[11px] text-gray-500 mt-1">
                    A dish, your ingredients, a pantry shelf or a grocery list. JPG, PNG or WebP, up to 4 MB.
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={chooseImage}
                    className="sr-only"
                  />
                </label>
              ) : (
                <div className="flex items-start gap-3">
                  <img
                    src={imagePreview}
                    alt="Your selected photo"
                    className="h-24 w-24 rounded-lg object-cover border border-gray-200"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-black truncate">{imageFile.name}</p>
                    <input
                      type="text"
                      value={imageNote}
                      onChange={(e) => setImageNote(e.target.value)}
                      maxLength={300}
                      placeholder="Optional: for 4 people, under ₱500"
                      aria-label="Optional note about your photo"
                      className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-800 placeholder-gray-500 focus:outline-none"
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={submitImage}
                        disabled={asking}
                        className="rounded bg-[#006e00] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        Get recommendations
                      </button>
                      <button
                        type="button"
                        onClick={clearImage}
                        disabled={asking}
                        className="rounded border border-gray-300 px-3 py-1.5 text-[11px] font-bold text-gray-700 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I agree to send this photo to the configured Gemini provider.</label>
              <p className="mt-3 text-[11px] text-gray-500">
                Your photo is sent to Google&rsquo;s Gemini AI service to find matching products. It is not saved on our server.
              </p>
            </div>
          )}

          {asking && (
            <p role="status" className="mt-3 text-xs text-gray-600">
              {activeTab === 'upload' ? 'Reading your photo...' : 'Finding products...'}
            </p>
          )}
          {askError && <p role="alert" className="mt-3 text-xs text-red-600">{askError}</p>}
        </div>

        {/* Ask / photo results */}
        {askResult && !asking && (
          <div className="mb-6 border border-green-300 bg-green-50/40 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h2 className="text-xs font-bold text-black">
                {askResult.kind === 'image'
                  ? 'Results for your photo'
                  : <>Results for &ldquo;{askResult.query}&rdquo;</>}
              </h2>
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
              {askResult.meta?.understanding?.startsWith('gemini') && (
                <span className="text-[10px] bg-white border border-blue-300 text-blue-900 rounded-full px-2 py-0.5">
                  Understood by AI
                </span>
              )}
            </div>

            {askResult.meta?.understanding === 'keyword' && <p className="mb-2 text-xs text-amber-800">Local keyword/rule fallback ? Gemini was unavailable or unconfigured.</p>}
            <p className="mb-3 text-xs text-gray-600">Estimates only; review current prices and stock at Checkout. One unit per match is a starting point. Adjust quantities in My Cart; serving sizes are not guaranteed.</p>
            {detected.length > 0 && (
              <p className="mb-2 text-[11px] text-gray-600">I can see: {detected.join(', ')}</p>
            )}

            {askItems.length === 0 ? (
              <p className="text-xs text-gray-600">{askEmptyMessage()}</p>
            ) : (
              <>
                <ul className="divide-y divide-green-100">
                  {askItems.map((item) => (
                    <li key={item.store_inventory_id} className="flex items-center justify-between gap-3 py-2">
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
                        <button type="button" onClick={() => loadAlternatives(item)} className="text-xs text-green-800 underline">View alternatives</button>
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

        {alternativeError && <p role="alert" className="mb-4 text-red-700">{alternativeError}</p>}
        {alternatives && <section aria-label="Alternative products" className="mb-6 rounded-xl border border-green-200 p-4"><h2 className="font-semibold">Alternatives for {alternatives.name}</h2><p className="my-2 text-xs">Same supermarket and category. Choose an item explicitly; confirmed orders are never changed.</p>{!alternatives.enabled ? <p>Alternative suggestions are disabled for this store.</p> : alternatives.items.length === 0 ? <p>No available alternatives in this store.</p> : <div className="grid gap-3 sm:grid-cols-3">{alternatives.items.map(item => <ProductCard key={item.store_inventory_id} item={item} onAdd={handleAdd} onAlternatives={loadAlternatives} />)}</div>}</section>}
        {/* Recommendations Grid Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-500 mt-0.5" />
              <div>
                <h2 className="text-xs font-bold text-black">Recommendation for you</h2>
                <p className="text-[11px] text-gray-500">Based on completed store purchases, cart context and available inventory.</p>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {visibleItems.map((item) => (
                <ProductCard key={item.product_id} item={item} onAdd={handleAdd} onAlternatives={loadAlternatives} />
              ))}
            </div>
          )}
        </div>

        </fieldset>
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
