import SessionHeartbeat from "../../components/SessionHeartbeat";
import ExaminerProfileGate from "../../components/ExaminerProfileGate";

export default function AdminLayout({ children }) {
  return (
    <>
      <SessionHeartbeat />
      <ExaminerProfileGate>{children}</ExaminerProfileGate>
    </>
  );
}
