import { Suspense } from "react";
import ActivateAccount from "../../components/ActivateAccount";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={null}>
      <ActivateAccount />
    </Suspense>
  );
}
