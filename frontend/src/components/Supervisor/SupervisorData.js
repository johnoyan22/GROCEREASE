// SupervisorData.js
// Static mock data only — there is no backend. Everything here is
// held in memory and edited through React state in SupervisorDashboardPage.jsx.

export const storeInfo = {
  name: 'Colonnade Supermarket',
  address: 'Colon St, Cebu city',
}

export const profileDefault = {
  role: 'Supervisor',
  firstName: 'Maria',
  lastName: 'Santos',
  email: 'supervisor@grocerease.ph',
  phone: '0917-555-0123',
  photoUrl: '',
}

export const systemConfigDefault = {
  storeName: 'Colonnade Supermarket',
  lowStockThreshold: 10,
  maxOrdersPerWorker: 4,
  morningShift: '8:00 AM - 12:00 PM',
  afternoonShift: '12:00 PM - 5:00 PM',
  eveningShift: '5:00 PM - 9:00 PM',
  pickupEnabled: true,
  copEnabled: true,
  prepaidEnabled: true,
  autoAssignWorkers: true,
  notifyOnNewOrder: true,
  notifyOnLowStock: true,
  notifyOnPaymentFail: true,
}

export const initialOrders = [
  { id: 'ORD-0001234', customer: 'Juan Dela Cruz', items: 3, paymentMethod: 'Prepaid', status: 'Preparing', workerId: 'W1', pickupTime: '3:00 PM' },
  { id: 'ORD-0001235', customer: 'Ana Reyes', items: 5, paymentMethod: 'COP', status: 'Pending Assignment', workerId: null, pickupTime: '4:00 PM' },
  { id: 'ORD-0001236', customer: 'Carlo Tan', items: 2, paymentMethod: 'Prepaid', status: 'Ready for Pickup', workerId: 'W2', pickupTime: '2:30 PM' },
  { id: 'ORD-0001240', customer: 'Rico Villanueva', items: 6, paymentMethod: 'Online', status: 'Preparing', workerId: 'W2', pickupTime: '3:30 PM' },
  { id: 'ORD-0001242', customer: 'Paolo Diaz', items: 2, paymentMethod: 'COP', status: 'Pending Assignment', workerId: null, pickupTime: '7:00 PM' },
  { id: 'ORD-0001239', customer: 'Sofia Cruz', items: 4, paymentMethod: 'Online', status: 'Completed', workerId: 'W1', pickupTime: '1:00 PM' },
  { id: 'ORD-0001238', customer: 'Liza Ong', items: 1, paymentMethod: 'COP', status: 'Completed', workerId: 'W3', pickupTime: '11:30 AM' },
  { id: 'ORD-0001237', customer: 'Marco Silva', items: 3, paymentMethod: 'Prepaid', status: 'Completed', workerId: 'W4', pickupTime: '10:45 AM' },
]

export const initialWorkers = [
  { id: 'W1', name: 'John Reyes', role: 'Packer', assignedOrderId: 'ORD-0001234', availability: 'Busy', shift: 'Morning 8:00 AM - 5:00 PM', ordersCompleted: 10, avgPrepTime: '12 min', completionRate: 94 },
  { id: 'W2', name: 'Vans Gonzales', role: 'Picker', assignedOrderId: 'ORD-0001236', availability: 'Busy', shift: 'Afternoon 12:00 PM - 9:00 PM', ordersCompleted: 14, avgPrepTime: '10 min', completionRate: 90 },
  { id: 'W3', name: 'Mia Cruz', role: 'Picker', assignedOrderId: null, availability: 'Available', shift: 'Evening 1:00 PM - 9:00 PM', ordersCompleted: 11, avgPrepTime: '11 min', completionRate: 88 },
  { id: 'W4', name: 'John Oyan', role: 'Packer', assignedOrderId: null, availability: 'Available', shift: 'Morning 8:00 AM - 5:00 PM', ordersCompleted: 9, avgPrepTime: '13 min', completionRate: 85 },
  { id: 'W5', name: 'Ken Alonzo', role: 'Packer', assignedOrderId: null, availability: 'Available', shift: 'Morning 8:00 AM - 5:00 PM', ordersCompleted: 12, avgPrepTime: '9 min', completionRate: 91 },
]

export const shiftCapacity = [
  { id: 'morning', label: 'Morning', filled: 8, total: 10 },
  { id: 'afternoon', label: 'Afternoon', filled: 6, total: 10 },
  { id: 'evening', label: 'Evening', filled: 4, total: 8 },
]

export const workerActivity = [
  { id: 1, message: 'Completed Order ORD-000123', time: '10:00 AM' },
  { id: 2, message: 'Started preparing ORD-0001234', time: '2:10 PM' },
  { id: 3, message: 'Marked available for assignment', time: '2:40 PM' },
  { id: 4, message: 'Clocked in for morning shift', time: '8:02 AM' },
]

export const inventoryItems = [
  { id: 1, name: 'Sardines', stockPercent: 18 },
  { id: 2, name: 'Fresh Milk', stockPercent: 32 },
  { id: 3, name: 'White Bread', stockPercent: 45 },
  { id: 4, name: 'Rice 25kg', stockPercent: 60 },
  { id: 5, name: 'Bananas', stockPercent: 80 },
  { id: 6, name: 'Cooking Oil', stockPercent: 100 },
]

export const initialStockRequests = [
  { id: 'SA-23-234', itemName: 'Sardines', category: 'Canned goods', currentStock: 4, requestedUpdate: 'Low Stock', submittedBy: 'Juan S.', priority: 'High', submittedTime: '4:39 PM', status: 'Pending' },
  { id: 'SA-23-235', itemName: 'Fresh Milk 1L', category: 'Dairy', currentStock: 8, requestedUpdate: 'Restock', submittedBy: 'Mia C.', priority: 'Medium', submittedTime: '3:12 PM', status: 'Pending' },
  { id: 'SA-23-236', itemName: 'Bananas', category: 'Produce', currentStock: 40, requestedUpdate: 'Availability change', submittedBy: 'Ken A.', priority: 'Low', submittedTime: '2:05 PM', status: 'Approved' },
  { id: 'SA-23-239', itemName: 'Rice 25kg', category: 'Staples', currentStock: 6, requestedUpdate: 'Low Stock', submittedBy: 'John R.', priority: 'High', submittedTime: '10:05 AM', status: 'Pending' },
  { id: 'SA-23-240', itemName: 'Cooking Oil 1L', category: 'Grocery', currentStock: 18, requestedUpdate: 'Availability change', submittedBy: 'Aira D.', priority: 'Low', submittedTime: '9:40 AM', status: 'Needs Review' },
]

export const initialPayments = [
  { id: 'GE-23-234', customer: 'Juan Dela Cruz', orderId: 'ORD-0001234', method: 'Online', amount: 210, status: 'Successful', dateTime: 'July 30 2026 6:00PM', verifiedBy: 'Vans G.', items: [{ name: 'Sardines', qty: 3, unitPrice: 35 }, { name: 'Rice 5kg', qty: 1, unitPrice: 105 }], timeline: [{ label: 'Payment received', time: '6:00 PM' }, { label: 'Verified', time: '6:02 PM' }] },
  { id: 'GE-23-235', customer: 'Ana Reyes', orderId: 'ORD-0001235', method: 'COP', amount: 345, status: 'Pending', dateTime: 'July 30 2026 4:20PM', verifiedBy: '—', items: [{ name: 'Fresh Milk 1L', qty: 3, unitPrice: 85 }, { name: 'Bread', qty: 2, unitPrice: 45 }], timeline: [{ label: 'Order placed', time: '4:20 PM' }] },
  { id: 'GE-23-236', customer: 'Carlo Tan', orderId: 'ORD-0001236', method: 'Debit Card', amount: 120, status: 'Successful', dateTime: 'July 30 2026 2:05PM', verifiedBy: 'Maria S.', items: [{ name: 'Cooking Oil 1L', qty: 1, unitPrice: 120 }], timeline: [{ label: 'Payment received', time: '2:05 PM' }, { label: 'Verified', time: '2:06 PM' }] },
  { id: 'GE-23-239', customer: 'Rico Villanueva', orderId: 'ORD-0001240', method: 'Online', amount: 410, status: 'Pending', dateTime: 'July 29 2026 3:30PM', verifiedBy: '—', items: [{ name: 'Bananas', qty: 5, unitPrice: 30 }, { name: 'Rice 25kg', qty: 1, unitPrice: 260 }], timeline: [{ label: 'Order placed', time: '3:30 PM' }] },
  { id: 'GE-23-240', customer: 'Sofia Cruz', orderId: 'ORD-0001241', method: 'Debit Card', amount: 195, status: 'Refunded', dateTime: 'July 29 2026 1:15PM', verifiedBy: 'Maria S.', items: [{ name: 'Sardines', qty: 4, unitPrice: 35 }, { name: 'Bread', qty: 1, unitPrice: 55 }], timeline: [{ label: 'Payment received', time: '1:15 PM' }, { label: 'Refund issued', time: '1:40 PM' }] },
]

export const initialReturns = [
  { id: 'GE-23-234', customer: 'Juan Dela', orderId: 'ORD-0001234', type: 'Return', reason: 'Damaged Item', status: 'Approved', dateSubmitted: 'July 30, 2026' },
  { id: 'RF-23-101', customer: 'Ana Reyes', orderId: 'ORD-0001235', type: 'Refund', reason: 'Wrong Item', status: 'Pending', dateSubmitted: 'July 30, 2026' },
  { id: 'RF-23-102', customer: 'Carlo Tan', orderId: 'ORD-0001236', type: 'Return', reason: 'Expired Product', status: 'In Review', dateSubmitted: 'July 29, 2026' },
  { id: 'RF-23-105', customer: 'Rico Villanueva', orderId: 'ORD-0001240', type: 'Refund', reason: 'Missing Item', status: 'Pending', dateSubmitted: 'July 30, 2026' },
]

export const returnReasons = [
  { reason: 'Damaged Item', count: 18 },
  { reason: 'Wrong Item', count: 12 },
  { reason: 'Expired Product', count: 9 },
  { reason: 'Missing Item', count: 7 },
]

export const dailySales = [
  { day: 'Mon', amount: 420 },
  { day: 'Tue', amount: 510 },
  { day: 'Wed', amount: 380 },
  { day: 'Thu', amount: 640 },
  { day: 'Fri', amount: 720 },
  { day: 'Sat', amount: 800 },
  { day: 'Sun', amount: 560 },
]

export const categorySales = [
  { category: 'Produce', amount: 12400 },
  { category: 'Dairy', amount: 8600 },
  { category: 'Grocery', amount: 15200 },
  { category: 'Bakery', amount: 4100 },
  { category: 'Meat', amount: 9800 },
]

export const salesByPayment = [
  { method: 'Prepaid', amount: 12100 },
  { method: 'Online', amount: 9800 },
  { method: 'Debit Card', amount: 6900 },
  { method: 'COP', amount: 4200 },
]

export const initialNotifications = [
  { id: 1, title: 'Item is running low on stock', description: 'Sardines is below the threshold at Colonnade. Review the stock approval request SA-23-234.', date: 'July 30, 2026', time: '3:00 PM', unread: true },
  { id: 2, title: 'Payment Successful (Cash on pick up)', description: 'Your payment for Order #0001234 has been received. The order can now proceed to packing.', date: 'July 30, 2026', time: '2:48 PM', unread: true },
  { id: 3, title: 'Payment Successful (Debit Card)', description: 'Debit card payment for Order #0001236 was verified successfully.', date: 'July 30, 2026', time: '2:05 PM', unread: false },
  { id: 4, title: 'John Reyes Started Preparing', description: 'Worker John Reyes started preparing order ORD-0001234.', date: 'July 30, 2026', time: '2:10 PM', unread: false },
  { id: 5, title: 'New Order Received', description: 'A new pickup order ORD-0001242 is waiting for worker assignment.', date: 'July 28, 2026', time: '4:55 PM', unread: true },
  { id: 6, title: 'Order Received', description: 'Order ORD-0001239 is ready to be assigned to an available picker.', date: 'July 28, 2026', time: '4:20 PM', unread: false },
]
