import InvoiceSellerSettings from '../../components/admin/InvoiceSellerSettings';
import ReportWorkspace from '../../components/reports/ReportWorkspace';
import { Link } from 'react-router-dom';

export default function ReportModule() {
  return <div className="space-y-6"><div className="flex flex-wrap gap-3"><Link to="/admin/cop" className="rounded-lg border bg-white px-4 py-2 text-sm">COP Monitoring</Link><Link to="/admin/stores" className="rounded-lg border bg-white px-4 py-2 text-sm">Store Oversight</Link></div><ReportWorkspace role="admin" /><InvoiceSellerSettings /><p className="text-sm text-slate-500">Worker incentive reports await an approved allocation formula. SaaS subscription revenue is not configured. Invoice documents remain Draft / Pro Forma until partner authorization is complete.</p></div>;
}
