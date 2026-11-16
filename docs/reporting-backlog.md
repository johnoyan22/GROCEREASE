# Future reporting scope

This is future work, separate from the Inventory Worker UI cleanup. It adds no menu destination,
report implementation, PDF button or automated notification.

- Inventory Reports should cover the assigned store's stock summary, recorded batches and expiry,
  stock additions, count corrections, and relevant stock movement/audit evidence. Offering-status
  activity is currently the narrower **Activity Log**; keep that name until a working report
  destination can include it as a report type or section without duplicate navigation.
- Supervisor reports cover authorized store operations, orders, sales and transactions.
- Admin reports cover authorized cross-store and administrative scope.
- Later PDF exports must use the same report dataset, validated totals, filters, store/role scope
  and period displayed onscreen, and include generated time and user/store context.
- Staff message delivery, automated notifications, unread tracking and scheduled alerts require
  separate implementation. Existing stock request/report updates remain supported without fake counts.
