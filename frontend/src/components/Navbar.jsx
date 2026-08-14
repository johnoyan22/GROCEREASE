function Navbar() {
    return (
        <nav className="flex items-center justify-between px-8 py-4 bg-white">
                <div className="text-3xl font-bold">
                    Grocer<span className="text-green-700">Ease</span>
                </div>

                <div className="flex items-center gap-6 text-xl font-semibold">
                    <a href="#" className="text-green-700">Home</a>
                    <a href="#" className="text-red-500">Products</a>
                </div>

                <div>
                    <input type="text" placeholder="Search for products"
                    className="w-60 rounded-md border-2 border-gray-400 px-3 py-2 text-sm">
                    </input>
                </div>

                <div className="flex items-center gap-6">
                    <button className="rounded-md border-2 border-green-700 px-5 py-2 text-xs text-green-700 font-semibold">LOGIN</button>
                    <button className="rounded-md border-2 border-red-500 bg-red-500 px-5 py-2 text-xs text-white font-semibold">REGISTER</button>
                </div>
        </nav>
    );
}
export default Navbar;