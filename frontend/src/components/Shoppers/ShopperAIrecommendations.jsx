import { useState } from 'react';
import { 
  Search, ShoppingCart, Bell, ChevronDown, User, MessageSquare, 
  Image as ImageIcon, ArrowRight, Sparkles, Lightbulb 
} from 'lucide-react';

const recommendations = [
  { id: 1, name: 'Bananas', price: '₱ 45.00 / kg', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=300&q=80' },
  { id: 2, name: 'Milk 1L', price: '₱ 75.00', image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=300&q=80' },
  { id: 3, name: 'Eggs', price: '₱ 75.00', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=300&q=80' },
  { id: 4, name: 'Meats', price: '₱ 400.00 / kg', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=300&q=80' },
  { id: 5, name: 'Dishwashing liquid', price: '₱ 75.00', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=300&q=80' },
];

export default function ShopperAIRecommendations() {
  const [activeTab, setActiveTab] = useState('ask');
  const [query, setQuery] = useState('');

  const handlePillClick = (text) => {
    setQuery(text);
  };

  return (
    <div className="flex-1 bg-white min-h-screen flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <button className="text-gray-700 hover:text-black">
            <div className="w-6 h-0.5 bg-black mb-1"></div>
            <div className="w-6 h-0.5 bg-black mb-1"></div>
            <div className="w-6 h-0.5 bg-black"></div>
          </button>
          
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search for products, categories..."
              className="w-full border border-gray-400 rounded-lg px-4 py-1.5 pr-10 text-xs focus:outline-none focus:border-[#006e00]"
            />
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-700" />
          </div>
        </div>

        <div className="flex items-center gap-5">
          <button className="relative text-gray-700 hover:text-black">
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">1</span>
          </button>
          
          <button className="relative text-gray-700 hover:text-black">
            <Bell className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">1</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 cursor-pointer">
            <div className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span>Shopper</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-6 max-w-5xl">
        {/* Header Title */}
        <div className="mb-4">
          <h1 className="text-sm font-bold text-black">AI Recommendations</h1>
          <p className="text-xs text-gray-600 mt-0.5">Ask anything or upload an image to get personalized product recommendation.</p>
        </div>

        {/* AI Prompt Container */}
        <div className="border border-gray-400 rounded-xl p-4 mb-6">
          {/* Tabs */}
          <div className="flex gap-6 border-b border-gray-200 pb-2 mb-3">
            <button 
              onClick={() => setActiveTab('ask')}
              className={`flex items-center gap-1.5 text-xs font-bold transition relative pb-1 ${activeTab === 'ask' ? 'text-black' : 'text-gray-500'}`}
            >
              <MessageSquare className="w-4 h-4" />
              Ask anything
              {activeTab === 'ask' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#006e00]"></span>}
            </button>

            <button 
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 text-xs font-bold transition relative pb-1 ${activeTab === 'upload' ? 'text-black' : 'text-gray-500'}`}
            >
              <ImageIcon className="w-4 h-4" />
              Upload image
              {activeTab === 'upload' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#006e00]"></span>}
            </button>
          </div>

          {/* Prompt Input Box */}
          <div className="border border-gray-300 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for today?" 
                className="w-full text-xs focus:outline-none text-gray-800 placeholder-gray-500"
              />
              <button className="border border-gray-400 rounded p-1 hover:bg-gray-100 transition shrink-0">
                <ArrowRight className="w-4 h-4 text-gray-700" />
              </button>
            </div>

            {/* Quick Suggestion Pills */}
            <div className="flex items-center gap-2 mt-4 text-[11px]">
              <span className="text-gray-600 font-medium">Try asking:</span>
              <button onClick={() => handlePillClick('Healthy Breakfast Idea')} className="bg-green-200 text-green-900 px-2.5 py-0.5 rounded-full font-medium hover:bg-green-300">
                Healthy Breakfast Idea
              </button>
              <button onClick={() => handlePillClick('Ingredients for pasta')} className="bg-green-200 text-green-900 px-2.5 py-0.5 rounded-full font-medium hover:bg-green-300">
                Ingredients for pasta
              </button>
              <button onClick={() => handlePillClick('Snacks for kids')} className="bg-green-200 text-green-900 px-2.5 py-0.5 rounded-full font-medium hover:bg-green-300">
                Snacks for kids
              </button>
            </div>
          </div>
        </div>

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
            <button className="text-xs font-bold text-[#006e00] hover:underline flex items-center gap-0.5">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-5 gap-3">
            {recommendations.map((item) => (
              <div key={item.id} className="border border-gray-300 rounded-xl p-2.5 flex flex-col justify-between items-center text-center bg-white">
                <div className="w-full h-24 flex items-center justify-center mb-2">
                  <img src={item.image} alt={item.name} className="max-h-full object-contain rounded" />
                </div>
                <div className="w-full">
                  <h3 className="text-xs font-bold text-black truncate">{item.name}</h3>
                  <p className="text-xs font-black text-black mt-0.5">{item.price}</p>
                  <button className="mt-2 w-full bg-green-100 text-[#006e00] text-[10px] font-bold py-1 rounded hover:bg-green-200 transition">
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
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