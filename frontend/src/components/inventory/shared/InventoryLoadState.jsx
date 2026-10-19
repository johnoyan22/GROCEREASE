export default function InventoryLoadState({ loading, error, onRetry }) {
  if (loading) {
    return <p role="status" className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading your store inventory...</p>;
  }
  if (!error) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <p role="alert" className="text-sm text-red-800">{error}</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800">Retry</button>
    </div>
  );
}
