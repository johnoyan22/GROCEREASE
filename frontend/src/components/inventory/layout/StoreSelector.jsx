function StoreSelector() {
  return (
    <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left md:w-72">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-sm font-bold text-green-700">S</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-gray-700">Colonnade Supermarket</span>
        <span className="block truncate text-[10px] text-gray-400">Colon St., Cebu City</span>
      </span>
      <span aria-hidden="true" className="text-xs text-gray-400">v</span>
    </button>
  );
}

export default StoreSelector;
