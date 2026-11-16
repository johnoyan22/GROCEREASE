import ProductTable from '../product-management/ProductTable';

function StockTable({ items }) {
  return <ProductTable products={items} showReceivedDate />;
}

export default StockTable;
