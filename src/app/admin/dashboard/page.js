import AdminDashboard from "../../../components/AdminDashboard";

// Disable caching for admin dashboard
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminDashboardPage() {
  return <AdminDashboard />;
}
