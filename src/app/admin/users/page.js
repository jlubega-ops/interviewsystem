import UsersManagement from "../../../components/UsersManagement";

// Disable caching for users management page
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function UsersManagementPage() {
  return <UsersManagement />;
}
