import { ArrowDown, Clock, CheckCircle2, User, Bell, ArrowRight, ShoppingBag } from 'lucide-react';

export default function ShopperPickupInformation() {
  return (
    <div className="flex-1 bg-white min-h-screen p-6 font-sans">
      {/* Header Title */}
      <div className="mb-6">
        <h1 className="text-sm font-bold text-black">Pick up Information</h1>
        <p className="text-xs text-gray-600 mt-0.5">Track your order and pick up status.</p>
      </div>

      <div className="max-w-4xl space-y-3">
        {/* Step 1 Card: Searching for Worker */}
        <div className="border border-gray-300 rounded-xl p-5 flex items-center gap-6 bg-white shadow-sm">
          {/* Radar / Worker Search Illustration */}
          <div className="w-48 h-36 border border-gray-100 rounded-lg bg-emerald-50/30 flex items-center justify-center relative shrink-0 overflow-hidden">
            <div className="absolute w-28 h-28 border border-green-200/60 rounded-full flex items-center justify-center">
              <div className="w-16 h-16 border border-green-300/80 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center shadow-sm">
                  <ShoppingBag className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
            {/* Worker Avatars */}
            <div className="absolute top-3 left-4 bg-green-100 p-1 rounded-full border border-green-300">
              <User className="w-3.5 h-3.5 text-green-800" />
            </div>
            <div className="absolute top-3 right-4 bg-green-100 p-1 rounded-full border border-green-300">
              <User className="w-3.5 h-3.5 text-green-800" />
            </div>
            <div className="absolute bottom-3 left-6 bg-green-100 p-1 rounded-full border border-green-300">
              <User className="w-3.5 h-3.5 text-green-800" />
            </div>
            <div className="absolute bottom-3 right-6 bg-green-100 p-1 rounded-full border border-green-300">
              <User className="w-3.5 h-3.5 text-green-800" />
            </div>
          </div>

          {/* Step 1 Details */}
          <div className="flex-1">
            <span className="inline-block bg-green-100 text-[#006e00] text-[11px] font-bold px-2.5 py-0.5 rounded mb-2">
              Order #0001234
            </span>
            <h2 className="text-base font-extrabold text-black leading-tight">
              Searching for available worker...
            </h2>
            <p className="text-xs text-gray-600 mt-1 max-w-md">
              We're finding the best available worker to prepare your order. This may take a few moments.
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 mb-3 max-w-sm overflow-hidden">
              <div className="bg-[#006e00] h-1.5 rounded-full w-2/5"></div>
            </div>

            {/* Status Banner */}
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-2.5 flex items-center gap-2 max-w-md">
              <Clock className="w-4 h-4 text-gray-700 shrink-0" />
              <div>
                <p className="text-xs font-bold text-black leading-none">Please wait</p>
                <p className="text-[10px] text-gray-500 mt-0.5">You will be notified once a worker accepts your order</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connecting Arrow */}
        <div className="flex justify-center my-1">
          <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-600">
            <ArrowDown className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Step 2 Card: Preparing Order */}
        <div className="border border-gray-300 rounded-xl p-5 flex items-center gap-6 bg-white shadow-sm">
          {/* Worker Profile Avatar Block */}
          <div className="w-48 h-36 border border-gray-100 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
            <div className="w-20 h-20 rounded-full border-2 border-slate-300 flex items-center justify-center bg-white text-slate-400">
              <User className="w-12 h-12 stroke-[1.5]" />
            </div>
          </div>

          {/* Step 2 Details */}
          <div className="flex-1">
            <span className="inline-block bg-green-100 text-[#006e00] text-[11px] font-bold px-2.5 py-0.5 rounded mb-2">
              Order #0001234
            </span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#006e00] fill-green-100" />
              <h2 className="text-base font-extrabold text-black">Preparing your order</h2>
            </div>
            <p className="text-xs text-gray-600 mt-1 max-w-md">
              Juan Dela Cruz has accepted your order and is now preparing your items with care
            </p>

            {/* Worker & Status Box */}
            <div className="border border-gray-300 rounded-lg p-2.5 grid grid-cols-2 gap-4 mt-3 max-w-sm">
              <div className="flex items-center gap-2 border-r border-gray-200 pr-2">
                <User className="w-5 h-5 text-gray-700 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-gray-500 block leading-none">Assigned worker</span>
                  <span className="text-xs font-bold text-black truncate block mt-0.5">Juan Dela Cruz</span>
                </div>
              </div>
              <div className="pl-1">
                <span className="text-[10px] text-gray-500 block leading-none">Status</span>
                <span className="text-xs font-bold text-[#006e00] block mt-0.5">Preparing</span>
              </div>
            </div>

            {/* Time Estimation */}
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-2 flex items-center gap-2.5 mt-2.5 max-w-sm">
              <div className="bg-[#006e00] p-1 rounded">
                <ShoppingBag className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block leading-none">Estimated time pick up</span>
                <span className="text-xs font-bold text-black block mt-0.5">July 28, 2026 3:00pm - 4:00pm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Alert Reminder */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-amber-100 rounded-full text-amber-800 shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-black">Please don't forget!</h3>
              <p className="text-xs text-gray-600">Make sure to pick up your order on your selected schedule.</p>
            </div>
          </div>
          <button className="bg-amber-100/80 text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-200 transition shrink-0 flex items-center gap-1">
            View My Orders <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}