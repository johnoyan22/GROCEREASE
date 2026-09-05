import Sidebar from "../../components/inventory/sidebar";
import Topbar from "../../components/inventory/Topbar";
import StatCards  from "../../components/inventory/StatCards"; 
function InventoryDashboard() {
    return (
        <div className="flex min-h-screen bg-gra-50 text-gray-800">
            <Sidebar/>
            <div className="flex-1 flex flex-col"> 
                <Topbar/>
                <main className="p-5">
                    <div className="mb-5">
                        <h1 className="text-3xl font-bold">Dashboard</h1>
                        <p className="text-sm">Welcome Back! Here's an overview of your inventory tasks and updates.</p>
                    </div>
                    <StatCards/>
                </main>
            </div> 
        </div>
        
    );
}

export default InventoryDashboard;