import { PickupSettingsWorkspace } from '../admin/StorePickupSettings';

export function SupervisorSystemConfiguration() {
  return <div className="max-w-5xl space-y-5">
    <div><h1 className="text-2xl font-bold">System Configuration</h1><p className="mt-2 text-sm text-gray-600">Manage operational pickup settings for your currently assigned store.</p></div>
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><PickupSettingsWorkspace /></div>
    <p className="text-sm text-gray-600">Picking/packing delegation is manual: one active order per worker. Manage stock thresholds in Stock Approvals. Platform COP restrictions and strike corrections remain under Admin oversight.</p>
  </div>;
}
