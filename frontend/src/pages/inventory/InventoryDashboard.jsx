import InventoryLayout from "../../components/inventory/InventoryLayout";
import StatCards  from "../../components/inventory/StatCards"; 
import PendingTasks from "../../components/inventory/PendingTasks";
import RecentUpdates from "../../components/inventory/RecentUpdates";
import RecentActivity from "../../components/inventory/RecentActivity";
import InventorySummary from "../../components/inventory/InventorySummary";

function InventoryDashboard() {
    return (
        <InventoryLayout>
            <div className="mb-5">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-sm">Welcome Back! Here's an overview of your inventory tasks and updates.</p>
            </div>

            <StatCards/>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PendingTasks/>
                <RecentUpdates/>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
                <RecentActivity/>
                <InventorySummary/>
            </div>    
        </InventoryLayout>
    );
}

export default InventoryDashboard;
