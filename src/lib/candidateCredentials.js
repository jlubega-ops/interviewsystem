export function getCandidateCredentials() {
  if (typeof window === "undefined") {
    return { candidateId: null, accessKey: null };
  }
  try {
    const data = JSON.parse(sessionStorage.getItem("candidate_data") || "null");
    return {
      candidateId: data?.id || null,
      accessKey: data?.accessKey || null,
    };
  } catch {
    return { candidateId: null, accessKey: null };
  }
}
