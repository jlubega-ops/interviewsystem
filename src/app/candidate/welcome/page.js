import CandidateWelcome from "../../../components/CandidateWelcome";

// Force dynamic rendering - this page should never be statically generated
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CandidateWelcomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <CandidateWelcome />
    </div>
  );
}
