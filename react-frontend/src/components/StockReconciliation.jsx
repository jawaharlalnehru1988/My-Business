import { useState, useEffect } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { getAllProducts, getAllWarehouses, reconcileStock } from '../store';
import { toast } from './Toast';

export default function StockReconciliation() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [observedQuantities, setObservedQuantities] = useState({});

  useEffect(() => {
    getAllProducts().then(setProducts).catch(() => toast('Failed to load products', 'error'));
    getAllWarehouses().then(data => {
      setWarehouses(data);
      if (data.length > 0) setSelectedWarehouseId(data[0].id.toString());
    }).catch(() => toast('Failed to load warehouses', 'error'));
  }, []);

  const handleQuantityChange = (productId, qty) => {
    setObservedQuantities({ ...observedQuantities, [productId]: qty });
  };

  const submitReconciliation = async (productId) => {
    if (!selectedWarehouseId) {
      toast('Please select a warehouse', 'error');
      return;
    }
    const observedQty = observedQuantities[productId];
    if (observedQty === undefined || observedQty === '') {
      toast('Please enter the observed quantity', 'error');
      return;
    }

    try {
      await reconcileStock(productId, selectedWarehouseId, observedQty);
      toast('Stock reconciled successfully', 'success');
      // Refresh products to get updated stock
      getAllProducts().then(setProducts);
    } catch (e) {
      toast('Failed to reconcile stock', 'error');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Physical Stock Reconciliation</h2>
          <p className="text-sm text-slate-500 mt-1">Record physical counts and automatically adjust system stock. Shrinkage will log an expense.</p>
        </div>
        <div>
          <select 
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="w-48 p-2 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium">Product</th>
              <th className="p-4 font-medium">System Stock</th>
              <th className="p-4 font-medium text-center">Observed Stock</th>
              <th className="p-4 font-medium">Difference</th>
              <th className="p-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {products.map(product => {
              const currentStock = product.stock || 0;
              const observed = observedQuantities[product.id];
              const diff = observed !== undefined && observed !== '' ? Number(observed) - currentStock : 0;
              
              return (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-800">{product.name}</td>
                  <td className="p-4 text-slate-600">{currentStock} {product.unit}</td>
                  <td className="p-4 text-center">
                    <input 
                      type="number"
                      value={observed !== undefined ? observed : ''}
                      onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                      className="w-24 p-2 border border-slate-300 rounded text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder={currentStock}
                    />
                  </td>
                  <td className="p-4">
                    {diff < 0 ? (
                      <span className="text-red-600 font-medium flex items-center gap-1">
                        <AlertTriangle size={14} /> {diff} (Shrink)
                      </span>
                    ) : diff > 0 ? (
                      <span className="text-green-600 font-medium">+{diff} (Found)</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => submitReconciliation(product.id)}
                      disabled={observed === undefined || observed === '' || diff === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save size={14} />
                      Reconcile
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {products.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-500">
                  No products available for reconciliation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
