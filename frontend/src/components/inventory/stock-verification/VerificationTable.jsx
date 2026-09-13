const priorityStyles = {
  High: "bg-red-50 text-red-600",
  Medium: "bg-orange-50 text-orange-700",
  Low: "bg-green-50 text-green-700",
};

const statusStyles = {
  Pending: "bg-orange-50 text-orange-700",
  Verified: "bg-green-50 text-green-700",
  Rejected: "bg-red-50 text-red-600",
};

function VerificationTable({ requests, onViewDetails }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Request ID</th>
              <th scope="col" className="px-4 py-3 font-medium">Requested By</th>
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">Items to Verify</th>
              <th scope="col" className="px-4 py-3 font-medium">Request Date</th>
              <th scope="col" className="px-4 py-3 font-medium">Priority</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-gray-700">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-50/70">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{request.id}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${request.requesterColor}`}>
                      {request.requesterInitials}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{request.requestedBy}</p>
                      <p className="text-[10px] text-gray-500">Supervisor</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-[9px] font-bold ${request.productColor}`}>
                      {request.productInitials}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{request.product}</p>
                      <p className="text-[10px] text-gray-500">{request.size} ({request.sku})</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{request.itemsToVerify}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <p>{request.requestDate}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">{request.requestTime}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${priorityStyles[request.priority]}`}>
                    {request.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${statusStyles[request.status]}`}>
                    {request.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onViewDetails(request)} className="whitespace-nowrap rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50">
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {requests.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="font-medium text-gray-700">No verification requests found</p>
          <p className="mt-1 text-xs text-gray-500">Try changing the selected tab or filters.</p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Showing {requests.length} request{requests.length === 1 ? "" : "s"}</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">Previous</button>
          <button type="button" className="rounded-md bg-green-700 px-3 py-2 text-white">1</button>
          <button type="button" disabled className="rounded-md border border-gray-200 px-3 py-2 disabled:opacity-40">Next</button>
        </div>
        <select aria-label="Requests per page" className="rounded-md border border-gray-200 bg-white px-3 py-2 outline-none focus:border-green-600">
          <option>10/page</option>
          <option>25/page</option>
          <option>50/page</option>
        </select>
      </div>
    </section>
  );
}

export default VerificationTable;
