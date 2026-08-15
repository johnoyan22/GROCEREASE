import Logo from "../assets/images/Logo.png";
function Navbar() {
    return (
        <nav className="flex items-center justify-between px-8 py-4 bg-white border-b-1 border-gray-300">
                <div className="flex items-center text-3xl font-bold">
                    <img src={Logo} className="h-14 w-14 object-contain"></img>
                    Grocer<span className="text-green-700">Ease</span>
                </div>

                <div className="flex items-center gap-6 text-xl font-semibold">
                    <a href="#">Home</a>
                    <a href="#">Products</a>
                    <a href="#">Categories</a>
                </div>

                <div className="relative">
                    <input type="text" placeholder="Search for products"
                    className="w-80 rounded-md border-2 border-gray-400 px-3 py-2 text-sm  pr-10">
                    </input>

                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>

                </div>

                <div className="flex items-center gap-6">
                    <button className="rounded-md border-2 border-green-700 px-5 py-2 text-xs text-green-700 font-semibold">LOGIN</button>
                    <button className="rounded-md border-2 border-red-500 bg-red-500 px-5 py-2 text-xs text-white font-semibold">REGISTER</button>
                </div>
        </nav>
    );
}
export default Navbar;