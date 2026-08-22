import herobg from "../assets/images/herobg.png";
import map from "../assets/images/map.png";

function HeroSection() {
  return (
    <section className="mx-auto mt-10 grid max-w-7xl overflow-hidden rounded-2xl bg-yellow-50 md:grid-cols-[3fr_1fr]">

      {/* LEFT SIDE */}
      <div className="bg-cover bg-center bg-no-repeat rounded-xl px-12 py-12 w-full" style={{ backgroundImage: `url(${herobg})` }}>
        <h1 className="text-5xl font-bold leading-tight"> Smart Grocery <br /><span className="text-red-500">Shopping,</span><br /><span className="text-green-900">Made Easy.</span></h1>
        <p className="mt-2 max-w-lg text-green-900">Shop your groceries online, get AI-powered<br />recommendations, and pick up in-store with ease.</p>

        <div className="mt-10 flex items-center gap-6 font-semibold">
          <button className="rounded-xl border border-red-500 bg-red-500 px-5 py-3 text-white">
            Start Shopping
          </button>

          <button className="rounded-xl border border-green-900 bg-white px-5 py-3 text-green-700">
            View Orders
          </button>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="place-content-center justify-items-center bg-white rounded-xl py-5 px-5 m-3 border border-gray-200">
        <div className="flex items-start gap-3">
            <div className="bg-green-900 rounded-4xl p-2">
                <svg width="24px" height="24px" viewBox="-4 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>location</title> <desc>Created with Sketch Beta.</desc> <defs> </defs> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage"> <g id="Icon-Set-Filled" sketch:type="MSLayerGroup" transform="translate(-106.000000, -413.000000)" fill="#ffffff"> <path d="M118,422 C116.343,422 115,423.343 115,425 C115,426.657 116.343,428 118,428 C119.657,428 121,426.657 121,425 C121,423.343 119.657,422 118,422 L118,422 Z M118,430 C115.239,430 113,427.762 113,425 C113,422.238 115.239,420 118,420 C120.761,420 123,422.238 123,425 C123,427.762 120.761,430 118,430 L118,430 Z M118,413 C111.373,413 106,418.373 106,425 C106,430.018 116.005,445.011 118,445 C119.964,445.011 130,429.95 130,425 C130,418.373 124.627,413 118,413 L118,413 Z" id="location" sketch:type="MSShapeGroup"> </path> </g> </g> </g></svg>
            </div>
            <div>
                <p className="text-green-900 font-bold text-2xl">Shop Near You.</p>
                <p className="text-green-900">Find a nearby supermarket for a quick in-store pickup.</p>
            </div>
        </div>

        <div className="mt-4 mb-4 w-full overflow-hidden border-2 border-gray-300 rounded-xl">
            <img src={map} alt="map" className="h-40 w-full object-cover rounded-xl"/>
        </div>
        <div className="text-left text-green-900">
            <p className="text-green-900 text-xl font-bold">Colonade Supermarket</p>
                <div className="mt-1 flex items-start gap-1">
                    <svg className="mt-1 h-4 w-4 shrink-0" width="16px" height="16px" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="#14532D"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill="var(--ci-primary-color, #14532D)" d="M253.924,127.592a64,64,0,1,0,64,64A64.073,64.073,0,0,0,253.924,127.592Zm0,96a32,32,0,1,1,32-32A32.037,32.037,0,0,1,253.924,223.592Z" class="ci-primary"></path> 
                    <path fill="var(--ci-primary-color, #14532D)" d="M376.906,68.515A173.922,173.922,0,0,0,108.2,286.426L229.107,472.039a29.619,29.619,0,0,0,49.635,0L399.653,286.426A173.921,173.921,0,0,0,376.906,68.515Zm-4.065,200.444L253.925,451.509,135.008,268.959C98.608,213.08,106.415,138.3,153.571,91.142a141.92,141.92,0,0,1,200.708,0C401.435,138.3,409.241,213.08,372.841,268.959Z" class="ci-primary"></path> </g>
                    </svg>
                    <p>Colonade, Cebu City, 6000</p>
                </div>
            <p>0.6km away | <span className="text-green-600 text-sm font-semibold">Open until 10:00pm</span></p>
        </div>
        <div>
            <button className="rounded-md bg-green-900 text-white font-semibold px-8 mt-3 mb-1 flex items-start gap-1">
                <svg className="mt-1.5 shrink-0" fill="#ffffff" width="14px" height="14px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                <g id="SVGRepo_iconCarrier"> <path d="M31.376 0c-0.191 0-0.422 0.054-0.691 0.168l-29.833 12.659c-1.074 0.456-1.142 1.334-0.151 1.951l8.43 5.251c0.991 0.617 2.301 1.94 2.912 2.939l5.053 8.274c0.29 0.474 0.64 0.71 0.977 0.71 0.372 0 0.727-0.286 0.97-0.851l12.758-29.805c0.345-0.808 0.148-1.296-0.426-1.297zM10.174 18.248l-6.833-4.257 22.925-9.726-14.756 15.006c-0.451-0.4-0.909-0.757-1.337-1.023zM17.898 28.602l-4.076-6.672c-0.241-0.394-0.558-0.814-0.912-1.231l14.825-15.075z"></path> </g>
                </svg> 
                Get Directions
            </button>
            <div className="flex items-start gap-1">
                <p className="text-green-600 font-semibold">View more nearby stores</p>
                <svg className="shrink-0 mt-1.5" width="14px" height="14px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#16a34a"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                    <g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M12.2929 4.29289C12.6834 3.90237 13.3166 3.90237 13.7071 4.29289L20.7071 11.2929C21.0976 11.6834 21.0976 12.3166 20.7071 12.7071L13.7071 19.7071C13.3166 20.0976 12.6834 20.0976 12.2929 19.7071C11.9024 19.3166 11.9024 18.6834 12.2929 18.2929L17.5858 13H4C3.44772 13 3 12.5523 3 12C3 11.4477 3.44772 11 4 11H17.5858L12.2929 5.70711C11.9024 5.31658 11.9024 4.68342 12.2929 4.29289Z" fill="#16a34a"></path> </g>
                </svg>
            </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;