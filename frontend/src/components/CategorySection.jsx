function CategorySection() {
  return (
    <section className="mx-auto mt-16 max-w-7xl px-8">

      {/* SECTION HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-green-900">Shop By Categories</h2>
        <button className="font-semibold text-red-700">View All</button>
      </div>

      {/* CATEGORY CARDS */}
      <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-5">
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