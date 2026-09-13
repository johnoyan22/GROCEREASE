import {
  PauseCircleIcon,
  StockUpdateIcon,
  VerificationIcon,
} from "../shared/InventoryIcons";

function VerificationStatCards({ requests }) {
  const stats = [
    {
      title: "Total Requests",
      value: requests.length,
      description: "All time requests",
      color: "bg-blue-50 text-blue-700",
      icon: <VerificationIcon className="h-5 w-5" />,
    },
    {
      title: "Pending",
      value: requests.filter((request) => request.status === "Pending").length,
      description: "Awaiting your verification",
      color: "bg-orange-50 text-orange-700",
      icon: <StockUpdateIcon className="h-5 w-5" />,
    },
    {
      title: "Verified",
      value: requests.filter((request) => request.status === "Verified").length,
      description: "Completed requests",
      color: "bg-green-50 text-green-700",
      icon: <VerificationIcon className="h-5 w-5" />,
    },
    {
      title: "Rejected / Cancelled",
      value: requests.filter((request) => request.status === "Rejected").length,
      description: "Rejected requests",
      color: "bg-purple-50 text-purple-700",
      icon: <PauseCircleIcon />,
    },
  ];

  return (
    <section aria-label="Verification request summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.title} className="flex min-h-28 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${stat.color}`}>
            {stat.icon}
          </span>
          <div>
            <p className="text-xs font-medium text-gray-500">{stat.title}</p>
            <p className="mt-1 text-xl font-bold text-gray-800">{stat.value}</p>
            <p className="mt-1 text-[11px] text-gray-400">{stat.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

export default VerificationStatCards;
