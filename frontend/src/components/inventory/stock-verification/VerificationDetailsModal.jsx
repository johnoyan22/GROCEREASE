function VerificationDetailsModal({ request, onClose, onUpdateStatus }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="verification-details-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="verification-details-title" className="text-lg font-bold text-gray-900">Verification Request</h2>
            <p className="mt-1 text-xs text-gray-500">{request.id}</p>
          </div>
          <button type="button" aria-label="Close request details" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">X</button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
            <span className={`flex h-12 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${request.productColor}`}>
              {request.productInitials}
            </span>
            <div>
              <p className="font-semibold text-gray-900">{request.product}</p>
              <p className="mt-1 text-xs text-gray-500">{request.size} · {request.sku}</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">Requested by</dt>
              <dd className="mt-1 font-medium text-gray-900">{request.requestedBy}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Items to verify</dt>
              <dd className="mt-1 font-medium text-gray-900">{request.itemsToVerify}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Request date</dt>
              <dd className="mt-1 font-medium text-gray-900">{request.requestDate}, {request.requestTime}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Priority</dt>
              <dd className="mt-1 font-medium text-gray-900">{request.priority}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Current status</dt>
              <dd className="mt-1 font-medium text-gray-900">{request.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Assigned location</dt>
              <dd className="mt-1 font-medium text-gray-900">Colonnade Supermarket</dd>
            </div>
          </dl>

          <div>
            <p className="text-xs text-gray-500">Supervisor note</p>
            <p className="mt-1 rounded-lg border border-gray-200 p-3 text-sm leading-6 text-gray-700">{request.note}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
          {request.status === "Pending" && (
            <>
              <button type="button" onClick={() => onUpdateStatus(request.id, "Rejected")} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">Reject Request</button>
              <button type="button" onClick={() => onUpdateStatus(request.id, "Verified")} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800">Mark as Verified</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default VerificationDetailsModal;
