import ActivateAccount from "../../components/ActivateAccount";

// Disable caching for activate account page
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ActivateAccountPage() {
  return <ActivateAccount />;
}
