import { Suspense } from "react";
import WelcomePage from "../components/WelcomePage";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <WelcomePage />
    </Suspense>
  );
}
