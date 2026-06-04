import CandidateAccess from "../../components/CandidateAccess";

// Force dynamic rendering - this page should never be statically generated
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CandidatePage() {
  return <CandidateAccess />;
}
