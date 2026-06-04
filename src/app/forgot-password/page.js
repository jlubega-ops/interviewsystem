import ForgotPassword from "../../components/ForgotPassword";

// Disable caching for forgot password page
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
