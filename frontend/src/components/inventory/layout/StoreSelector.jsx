function StoreSelector({ store }) {
  const storeName = store?.store_name ?? "Assigned store";
  const storeAddress = store?.address ?? "Loading store details...";

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left md:w-72">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-sm font-bold text-green-700">S</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-gray-700">{storeName}</span>
        <span className="block truncate text-[10px] text-gray-400">{storeAddress}</span>
      </span>
    </div>
  );
}

export default StoreSelector;
