import { useState } from 'react';
import { X, Plus, Minus, ArrowLeft } from 'lucide-react';

const categories = [
  { id: 1, name: 'Fruits', count: '4 Products', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=400&q=80' },
  { id: 2, name: 'Vegetables', count: '0 Products', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80' },
  { id: 3, name: 'Dairy & Eggs', count: '0 Products', image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=400&q=80' },
  { id: 4, name: 'Beverages', count: '0 Products', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80' },
  { id: 5, name: 'Meat & Poultry', count: '0 Products', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=400&q=80' },
  { id: 6, name: 'Household', count: '0 Products', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=400&q=80' },
];

const categoryProducts = {
  Fruits: [
    { id: 101, name: 'Fresh Bananas', price: 60, image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=300&q=80' },
    { id: 102, name: 'Red Apples', price: 85, image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=300&q=80' },
    { id: 103, name: 'Fresh Oranges', price: 70, image: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=300&q=80' },
    { id: 104, name: 'Green Grapes', price: 120, image: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&w=300&q=80' },
  ],
  'Dairy & Eggs': [],
};

const initialCart = [];

export default function ShopperBrowseProducts({ onCartChange }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cartItems, setCartItems] = useState(initialCart);

  const serviceCharge = 15;
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  const total = subtotal + (cartItems.length > 0 ? serviceCharge : 0);

  const addToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      const updated = existing 
        ? prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
        : [...prev, { ...product, qty: 1 }];
      if (onCartChange) onCartChange(updated);
      return updated;
    });
  };

  const updateQuantity = (id, change) => {
    setCartItems(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
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
      const updated = prev.filter(item => item.id !== id);
      if (onCartChange) onCartChange(updated);
      return updated;
    });
  };

  const currentProducts = selectedCategory ? (categoryProducts[selectedCategory.name] || []) : [];

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-white">
      <div className="flex gap-6 max-w-[1400px] mx-auto">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              {selectedCategory ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedCategory(null)}
                    className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 transition"
                  >
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
                  <p className="text-xs text-gray-500">Shops for a wide range Categories</p>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Sort by:</span>
              <select className="border border-gray-300 rounded px-2 py-1 bg-white text-xs font-medium focus:outline-none">
                <option>Featured</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
              </select>
            </div>
          </div>

          {!selectedCategory ? (
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
                  <button 
                    onClick={() => setSelectedCategory(cat)}
                    className="text-[10px] text-gray-700 font-bold hover:text-[#006e00] flex items-center gap-1"
                  >
                    View Products <span className="text-[#006e00]">→</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {currentProducts.length > 0 ? (
                currentProducts.map((prod) => (
                  <div key={prod.id} className="bg-white rounded-xl p-3 border border-gray-200 flex flex-col justify-between hover:shadow-md transition">
                    <div className="h-32 flex justify-center items-center mb-2">
                      <img src={prod.image} alt={prod.name} className="h-full object-contain rounded-lg" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{prod.name}</h4>
                      <p className="text-xs font-semibold text-[#006e00] mt-1">₱ {prod.price.toFixed(2)}</p>
                    </div>
                    <button 
                      onClick={() => addToCart(prod)}
                      className="mt-3 w-full bg-[#006e00] text-white text-[11px] font-bold py-1.5 rounded-lg hover:bg-[#005400] transition"
                    >
                      Add to Cart
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-10 text-xs text-gray-400">
                  No products available in this category yet.
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="w-72 bg-white border border-gray-300 rounded-xl p-4 flex flex-col justify-between shrink-0 shadow-sm h-fit">
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-2.5 relative flex items-center gap-3">
                <button 
                  onClick={() => removeItem(item.id)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 pr-4">
                  <h4 className="text-xs font-bold text-gray-900">{item.name}</h4>
                  <p className="text-[11px] font-semibold text-[#006e00] mt-0.5">₱ {item.price.toFixed(2)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-gray-300 rounded px-1.5 py-0.5 bg-gray-50">
                      <button onClick={() => updateQuantity(item.id, -1)} className="text-xs text-gray-600 hover:text-black">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold mx-2">{item.qty}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="text-xs text-gray-600 hover:text-black">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-xs font-bold text-gray-900">
                      ₱ {(item.price * item.qty).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {cartItems.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-6">Your cart is empty</p>
            )}
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
              className="w-full bg-[#006e00] hover:bg-[#005400] text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 mt-4 transition disabled:opacity-50"
            >
              Checkout <span>→</span>
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}