import herobg from "../assets/images/herobg.png";
import map from "../assets/images/map.png";

function HeroSection() {
  return (
    <section className="mx-auto mt-10 grid max-w-7xl overflow-hidden rounded-2xl bg-yellow-50 md:grid-cols-[3fr_1fr]">

      {/* LEFT SIDE */}
      <div className="bg-cover bg-center bg-no-repeat rounded-xl px-12 py-12 w-full" style={{ backgroundImage: `url(${herobg})` }}>
        <h1 className="text-5xl font-bold leading-tight"> Smart Grocery <br /><span className="text-red-500">Shopping,</span><br /><span className="text-green-700">Made Easy.</span></h1>
        <p className="mt-2 max-w-lg text-green-700">Shop your groceries online, get AI-powered<br />recommendations, and pick up in-store with ease.</p>

        <div className="mt-10 flex items-center gap-6 font-semibold">
          <button className="rounded-xl border border-red-500 bg-red-500 px-5 py-3 text-white">
            Start Shopping
          </button>

          <button className="rounded-xl border border-green-700 bg-white px-5 py-3 text-green-700">
            View Orders
          </button>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="place-content-center justify-items-center bg-white rounded-xl py-4 px-4 m-4">
        <div className="flex items-start gap-3">
            <div className="m-auto bg-green-700 rounded-4xl p-2">
                <svg width="40px" height="40px" viewBox="-4 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>location</title> <desc>Created with Sketch Beta.</desc> <defs> </defs> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage"> <g id="Icon-Set-Filled" sketch:type="MSLayerGroup" transform="translate(-106.000000, -413.000000)" fill="#ffffff"> <path d="M118,422 C116.343,422 115,423.343 115,425 C115,426.657 116.343,428 118,428 C119.657,428 121,426.657 121,425 C121,423.343 119.657,422 118,422 L118,422 Z M118,430 C115.239,430 113,427.762 113,425 C113,422.238 115.239,420 118,420 C120.761,420 123,422.238 123,425 C123,427.762 120.761,430 118,430 L118,430 Z M118,413 C111.373,413 106,418.373 106,425 C106,430.018 116.005,445.011 118,445 C119.964,445.011 130,429.95 130,425 C130,418.373 124.627,413 118,413 L118,413 Z" id="location" sketch:type="MSShapeGroup"> </path> </g> </g> </g></svg>
            </div>
            <div>
                <p className="text-green-700 font-bold text-2xl">Shop Near You.</p>
                <p className="text-green-700">Find a nearby supermarket for a quick in-store pickup.</p>
            </div>
        </div>

        <div className="mt-4 mb-4 w-full overflow-hidden border-2 border-gray-300 rounded-xl">
            <img src={map} alt="map" className="h-30 w-full object-cover rounded-xl"/>
        </div>

        <div>
            <button className="rounded-md bg-green-700 text-white font-semibold px-8">Get Directions</button>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;