function HeroSection() {
    return (
        <section className="mx-auto mt-10 max-w-7xl rounded-2xl bg-yellow-50 px-8 py-12">
            <div className="grid items-center md:grid-cols-2">

                <div>
                    <h1 className="text-5xl font-bold leading-tight">Smart Grocery <br/><span className="text-red-500">Shopping,</span> <br/><span className="text-green-700">Made Easy.</span></h1>
                    <p className="text-green-700 max-w-lg mt-2">Shop your groceries online, get AI-powered <br/> recommendations, and pick up in-store with ease.</p>

                    <div className="flex items-center mt-10 gap-6 font-semibold">
                        <button className="text-white bg-red-500 rounded-xl border border-red-500 py-3 px-5">Start Shopping</button>
                        <button className="text-green-700 bg-white border rounded-xl border-green-700 py-3 px-5">View Orders</button>
                    </div>
               </div>

               <div className="flex items-center justify-center">
                    <div className="h-80 w-full bg-white rounded-xl">

                    </div>
               </div>
            </div>
        </section>
    );
}

export default HeroSection;