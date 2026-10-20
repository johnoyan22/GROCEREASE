export default function FinancialSetup() {
  const policies = [
    ['Product markup', 'Not configured', 'Checkout uses each supermarket inventory selling price.'],
    ['Service charge allocation', 'Not configured', 'Checkout adds zero service charge. No pool or allocation is calculated.'],
    ['Worker tips and incentives', 'Pending approved formula', 'No worker credit, tip allocation or payout is calculated.'],
    ['Subscription revenue', 'Not available', 'SaaS subscriptions are separate from supermarket grocery payments.'],
  ];
  return <div className="max-w-7xl space-y-6"><div><h1 className="text-2xl font-bold text-slate-900">Financial Setup</h1><p className="mt-1 text-sm text-slate-500">Current implemented policies. Allocation and payout controls require an approved policy.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{policies.map(([name, state, description]) => <section key={name} className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold">{name}</h2><p className="mt-3 font-bold text-emerald-700">{state}</p><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p></section>)}</div></div>;
}
