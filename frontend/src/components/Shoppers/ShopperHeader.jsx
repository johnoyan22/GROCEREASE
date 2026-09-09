import { Search, ShoppingCart, Bell, User, ChevronDown } from 'lucide-react';

function ShopperHeader() {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <div className="relative w-full">
          <input 
            type="text" 
            placeholder="Search for products, categories..."
            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#006e00]"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer">
          <ShoppingCart className="w-5 h-5 text-gray-700" />
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">1</span>
        </div>

        <div className="relative cursor-pointer">
          <Bell className="w-5 h-5 text-gray-700" />
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">1</span>
        </div>

        <div className="flex items-center gap-2 cursor-pointer border-l pl-4 border-gray-200">
          <div className="w-8 h-8 rounded-full bg-gray-200 border flex items-center justify-center text-gray-700">
            <User className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-gray-800">Shopper</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </div>
      </div>
    </header>
  );
}

export default ShopperHeader;