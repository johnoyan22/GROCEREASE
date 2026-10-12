import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Plus, Minus, ArrowLeft, ShoppingBag, CreditCard, CheckCircle } from 'lucide-react';

const categoryImages = {
  'Fruits': 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80',
  'Vegetables': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80',
  'Dairy & Eggs': 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=400&q=80',
  'Beverages': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
  'Meat & Poultry': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=400&q=80',
  'Household': 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=400&q=80',
};

const defaultCategoryImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';

export default function ShopperBrowseProducts({ onCartChange, searchTerm = '' }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [sortBy, setSortBy] = useState('Featured');

  // Modal States
  const [activeProductModal, setActiveProductModal] = useState(null);
  const [modalQty, setModalQty] = useState(1);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash on Pickup');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
        const response = await axios.get(`${apiUrl}/products`);
        setProducts(response.data.data || response.data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch products for shopper catalog:", err);
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const categoryMap = {};
  products.forEach(prod => {
    const catName = prod.category || 'General';
    if (!categoryMap[catName]) categoryMap[catName] = 0;
    categoryMap[catName]++;
  });

  const categories = Object.keys(categoryMap).map((name, index) => ({
    id: index + 1,
    name,
    count: `${categoryMap[name]} Product${categoryMap[name] > 1 ? 's' : ''}`,
    image: categoryImages[name] || defaultCategoryImg
  }));

  let currentProducts = selectedCategory 
    ? products.filter(p => (p.category || 'General') === selectedCategory.name)
    : products;

  if (searchTerm && searchTerm.trim() !== '') {
    const query = searchTerm.toLowerCase();
    currentProducts = currentProducts.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(query);
      const skuMatch = (p.sku || '').toLowerCase().includes(query);
      const catMatch = (p.category || '').toLowerCase().includes(query);
      return nameMatch || skuMatch || catMatch;
    });
  }

  if (sortBy === 'Price: Low to High') {
    currentProducts.sort((a, b) => (Number(a.selling_price) || 0) - (Number(b.selling_price) || 0));
  } else if (sortBy === 'Price: High to Low') {
    currentProducts.sort((a, b) => (Number(b.selling_price) || 0) - (Number(a.selling_price) || 0));
  }

  const serviceCharge = 15;
  const subtotal = cartItems.reduce((acc, item) => acc + (Number(item.selling_price) || 0) * item.qty, 0);
  const total = subtotal + (cartItems.length > 0 ? serviceCharge : 0);

  const handleOpenProductModal = (product) => {
    setActiveProductModal(product);
    setModalQty(1);
  };

  const confirmAddToCart = () => {
    if (!activeProductModal) return;
    const product = activeProductModal;
    const availableStock = product.stock_quantity ?? 0;

    if (modalQty > availableStock) {
      alert(`Cannot add more than available stock (${availableStock})`);
      return;
    }

    setCartItems(prev => {
      const prodId = product.product_id || product.id;
      const existing = prev.find(item => (item.product_id || item.id) === prodId);
      const updated = existing 
        ? prev.map(item => (item.product_id || item.id) === prodId ? { ...item, qty: item.qty + modalQty } : item)
        : [...prev, { ...product, qty: modalQty }];
      if (onCartChange) onCartChange(updated);
      return updated;
    });

    setActiveProductModal(null);
  };

  const updateQuantity = (id, change) => {
    setCartItems(prev => {
      const updated = prev.map(item => {
        const itemId = item.product_id || item.id;
        if (itemId === id) {
          const newQty = item.qty + change;
          return newQty > 0 ? { ...item, qty: newQty } : item;
        }
        return item;
      });
      if (onCartChange) onCartChange(updated);
      return updated;
    });
  };

  const removeItem = (id) => {
    setCartItems(prev => {
      const updated = prev.filter(item => (item.product_id || item.id) !== id);
      if (onCartChange) onCartChange(updated);
      return updated;
    });
  };

  // Process Order (status can be 'Successful' or 'To pay')
  const handleCheckoutAction = async (targetStatus) => {
    setIsSubmitting(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
      
      const orderPayload = {
        items: cartItems.map(item => ({
          product_id: item.product_id || item.id,
          quantity: item.qty,
          price: item.selling_price,
          name: item.name
        })),
        subtotal,
        service_charge: serviceCharge,
        total,
        payment_method: paymentMethod,
        status: targetStatus // 'Successful' or 'To pay'
      };

      await axios.post(`${apiUrl}/orders`, orderPayload);

      setIsSubmitting(false);
      setOrderSuccess(true);
      setSuccessMessage(targetStatus === 'Successful' ? 'Checkout completed successfully!' : 'Order added to My Orders under "To pay".');
      setCartItems([]);
      if (onCartChange) onCartChange([]);
    } catch (err) {
      console.error("Order processing failed:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Stock validation failed or server error.");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex-1 p-10 text-center text-xs text-gray-500">Loading live product catalog from database...</div>;
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-white relative">
      <div className="flex gap-6 max-w-[1400px] mx-auto">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              {selectedCategory ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedCategory(null)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 transition">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className="text-base font-bold text-gray-900">{selectedCategory.name}</h1>
                    <p className="text-xs text-gray-500">Showing products in {selectedCategory.name}</p>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-base font-bold text-gray-900">Browse Products</h1>
                  <p className="text-xs text-gray-500">Shop for a wide range of categories</p>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Sort by:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-gray-300 rounded px-2 py-1 bg-white text-xs font-medium focus:outline-none">
                <option>Featured</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
              </select>
            </div>
          </div>

          {searchTerm && searchTerm.trim() !== '' ? (
            <div>
              <p className="text-xs text-gray-500 mb-3">Search results for "{searchTerm}":</p>
              <div className="grid grid-cols-3 gap-4">
                {currentProducts.length > 0 ? (
                  currentProducts.map((prod) => {
                    const prodId = prod.product_id || prod.id;
                    const priceVal = Number(prod.selling_price) || 0;
                    return (
                      <div key={prodId} className="bg-white rounded-xl p-3 border border-gray-200 flex flex-col justify-between hover:shadow-md transition">
                        <div className="h-32 flex justify-center items-center mb-2">
                          <img src={prod.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80'} alt={prod.name} className="h-full object-contain rounded-lg" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-900">{prod.name}</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5">Stock: {prod.stock_quantity ?? 0}</p>
                          <p className="text-xs font-semibold text-[#006e00] mt-1">₱ {priceVal.toFixed(2)}</p>
                        </div>
                        <button onClick={() => handleOpenProductModal(prod)} className="mt-3 w-full bg-[#006e00] text-white text-[11px] font-bold py-1.5 rounded-lg hover:bg-[#005400] transition">
                          Add to Cart
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-3 text-center py-10 text-xs text-gray-400">No products found matching "{searchTerm}".</div>
                )}
              </div>
            </div>
          ) : !selectedCategory ? (
            <div className="grid grid-cols-3 gap-4">
              {categories.map((cat) => (
                <div key={cat.id} className="bg-gray-100 rounded-xl p-3 border border-gray-200 flex flex-col justify-between hover:shadow-md transition">
                  <div>
                    <h3 className="text-xs font-bold text-gray-900">{cat.name}</h3>
                    <p className="text-[10px] text-[#006e00] font-semibold mt-0.5">{cat.count}</p>
                  </div>
                  <div className="my-3 flex justify-center items-center h-28">
                    <img src={cat.image} alt={cat.name} className="h-full object-contain rounded-lg" />
                  </div>
                  <button onClick={() => setSelectedCategory(cat)} className="text-[10px] text-gray-700 font-bold hover:text-[#006e00] flex items-center gap-1">
                    View Products <span className="text-[#006e00]">→</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {currentProducts.length > 0 ? (
                currentProducts.map((prod) => {
                  const prodId = prod.product_id || prod.id;
                  const priceVal = Number(prod.selling_price) || 0;
                  return (
                    <div key={prodId} className="bg-white rounded-xl p-3 border border-gray-200 flex flex-col justify-between hover:shadow-md transition">
                      <div className="h-32 flex justify-center items-center mb-2">
                        <img src={prod.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80'} alt={prod.name} className="h-full object-contain rounded-lg" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{prod.name}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">Stock: {prod.stock_quantity ?? 0}</p>
                        <p className="text-xs font-semibold text-[#006e00] mt-1">₱ {priceVal.toFixed(2)}</p>
                      </div>
                      <button onClick={() => handleOpenProductModal(prod)} className="mt-3 w-full bg-[#006e00] text-white text-[11px] font-bold py-1.5 rounded-lg hover:bg-[#005400] transition">
                        Add to Cart
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-3 text-center py-10 text-xs text-gray-400">No products available in this category yet.</div>
              )}
            </div>
          )}
        </div>

        {/* Shopping Cart Sidebar */}
        <aside className="w-72 bg-white border border-gray-300 rounded-xl p-4 flex flex-col justify-between shrink-0 shadow-sm h-fit">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-900 border-b pb-2">My Shopping Cart</h3>
            {cartItems.map((item) => {
              const itemId = item.product_id || item.id;
              const priceVal = Number(item.selling_price) || 0;
              return (
                <div key={itemId} className="border border-gray-200 rounded-lg p-2.5 relative flex items-center gap-3">
                  <button onClick={() => removeItem(itemId)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 pr-4">
                    <h4 className="text-xs font-bold text-gray-900">{item.name}</h4>
                    <p className="text-[11px] font-semibold text-[#006e00] mt-0.5">₱ {priceVal.toFixed(2)}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-gray-300 rounded px-1.5 py-0.5 bg-gray-50">
                        <button onClick={() => updateQuantity(itemId, -1)} className="text-xs text-gray-600 hover:text-black"><Minus className="w-3 h-3" /></button>
                        <span className="text-xs font-bold mx-2">{item.qty}</span>
                        <button onClick={() => updateQuantity(itemId, 1)} className="text-xs text-gray-600 hover:text-black"><Plus className="w-3 h-3" /></button>
                      </div>
                      <span className="text-xs font-bold text-gray-900">₱ {(priceVal * item.qty).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {cartItems.length === 0 && <p className="text-center text-xs text-gray-400 py-6">Your cart is empty</p>}
          </div>

          <div className="mt-6 pt-3 border-t border-gray-200 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold">₱ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Service Charge</span>
              <span className="font-semibold">₱ {cartItems.length > 0 ? serviceCharge.toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-gray-900 pt-2">
              <span>Total</span>
              <span className="text-base">₱ {total.toFixed(2)}</span>
            </div>
            <button 
              disabled={cartItems.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full bg-[#006e00] hover:bg-[#005400] text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 mt-4 transition disabled:opacity-50"
            >
              Checkout <span>→</span>
            </button>
          </div>
        </aside>
      </div>

      {/* --- ADD TO CART QUANTITY MODAL --- */}
      {activeProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative">
            <button onClick={() => setActiveProductModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h3 className="text-sm font-bold text-gray-900 mb-2">Select Quantity</h3>
            <p className="text-xs text-gray-500 mb-4">{activeProductModal.name}</p>
            <div className="flex items-center justify-center gap-4 my-6">
              <button onClick={() => setModalQty(Math.max(1, modalQty - 1))} className="p-2 border rounded-lg bg-gray-50"><Minus className="w-4 h-4" /></button>
              <span className="text-lg font-bold">{modalQty}</span>
              <button onClick={() => setModalQty(modalQty + 1)} className="p-2 border rounded-lg bg-gray-50"><Plus className="w-4 h-4" /></button>
            </div>
            <button onClick={confirmAddToCart} className="w-full bg-[#006e00] text-white text-xs font-bold py-2.5 rounded-lg hover:bg-[#005400] transition">
              Add to Cart - ₱ {((Number(activeProductModal.selling_price) || 0) * modalQty).toFixed(2)}
            </button>
          </div>
        </div>
      )}

      {/* --- CHECKOUT & PAYMENT MODAL WITH DUAL BUTTONS --- */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsCheckoutOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            
            {orderSuccess ? (
              <div className="text-center py-8 space-y-4">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                <h2 className="text-lg font-bold text-gray-900">Success!</h2>
                <p className="text-xs text-gray-500">{successMessage}</p>
                <button onClick={() => { setOrderSuccess(false); setIsCheckoutOpen(false); }} className="bg-[#006e00] text-white text-xs font-bold px-6 py-2.5 rounded-lg">
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-[#006e00]" /> Checkout Summary</h2>
                
                {/* Order Summary List */}
                <div className="border rounded-xl p-3 mb-4 space-y-2 max-h-40 overflow-y-auto bg-gray-50">
                  {cartItems.map(item => (
                    <div key={item.product_id || item.id} className="flex justify-between text-xs">
                      <span>{item.name} (x{item.qty})</span>
                      <span className="font-semibold">₱ {((Number(item.selling_price) || 0) * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Payment Method Selection */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-700 block mb-2 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-[#006e00]" /> Select Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#006e00]">
                    <option>Cash on Pickup</option>
                    <option>GCash / Digital Wallet</option>
                    <option>Credit / Debit Card</option>
                  </select>
                </div>

                {/* Totals Breakdown */}
                <div className="border-t pt-3 space-y-1.5 mb-6 text-xs">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-semibold">₱ {subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>Service Charge</span><span className="font-semibold">₱ {serviceCharge.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t"><span>Total Amount</span><span className="text-base text-[#006e00]">₱ {total.toFixed(2)}</span></div>
                </div>

                {/* DUAL ACTION BUTTONS */}
                <div className="flex gap-3">
                  <button 
                    disabled={isSubmitting}
                    onClick={() => handleCheckoutAction('To pay')}
                    className="flex-1 bg-gray-200 text-gray-800 text-xs font-bold py-3 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processing...' : 'Add to My Orders (Pay Later)'}
                  </button>
                  <button 
                    disabled={isSubmitting}
                    onClick={() => handleCheckoutAction('Successful')}
                    className="flex-1 bg-[#006e00] text-white text-xs font-bold py-3 rounded-lg hover:bg-[#005400] transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processing...' : 'Checkout Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}