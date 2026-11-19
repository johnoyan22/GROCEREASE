// Landing-page categories for the Shopper interface.
function CategorySection() {
  return (
    <section id="categories" className="mx-auto mt-8 max-w-7xl sm:mt-12">

      {/* SECTION HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold sm:text-3xl text-green-900">Shop By Categories</h2>
        <button className="font-semibold text-red-700">View All</button>
      </div>

      {/* CATEGORY CARDS */}
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
        <div>Fruits</div>
        <div>Vegetables</div>
        <div>Dairy & Eggs</div>
        <div>Beverages</div>
        <div>Meat & Poultry</div>
      </div>

    </section>
  );
}

export default CategorySection;
