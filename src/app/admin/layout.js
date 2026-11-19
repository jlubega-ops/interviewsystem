import SessionHeartbeat from "../../components/SessionHeartbeat";
import ExaminerProfileGate from "../../components/ExaminerProfileGate";
import AdminShell from "../../components/AdminShell";

export default function AdminLayout({ children }) {
  return (
    <>
      <SessionHeartbeat />
      <ExaminerProfileGate>
        <AdminShell>{children}</AdminShell>
      </ExaminerProfileGate>
    </>
  );
}
