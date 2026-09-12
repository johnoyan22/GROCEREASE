import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
function InventoryLayout({ children }) {
    return(
        <div className="flex min-h-screen bg-gray-50 text-gray-800">
            <Sidebar/>
            <div className="flex-1 flex flex-col min-w-0"> 
                <Topbar/>
                <main className="min-w-0 flex1 p-5">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default InventoryLayout;