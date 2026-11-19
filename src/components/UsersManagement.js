"use client";

import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Key,
  Mail,
  Ban,
  UserCheck,
} from "lucide-react";
import UserForm from "./UserForm";
import NavigationHeader from "./NavigationHeader";
import ConfirmationDialog from "./ConfirmationDialog";
import { useClientTable } from "../hooks/useClientTable";
import { TableSearch, TablePager, onTableRowClick } from "./ClientTableChrome";

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showUnsuspendDialog, setShowUnsuspendDialog] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [isResendingActivation, setIsResendingActivation] = useState(false);
  const [viewUserModal, setViewUserModal] = useState(null);
  const usersTable = useClientTable(users, {
    pageSize: 10,
    searchText: (u) =>
      [
        u.fullName,
        u.email,
        u.role,
        u.organisation,
        u.creator?.fullName,
        u.isSuspended ? "suspended" : "",
        u.isActivated ? "active" : "inactive",
      ].join(" "),
  });

  useEffect(() => {
    verifySession();
    fetchUsers();
  }, []);

  const verifySession = async () => {
    try {
      const response = await fetch("/api/auth/verify", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentUser(result.user);

        if (!["SUPERADMIN", "ADMIN"].includes(result.user.role)) {
          window.location.href = "/admin/dashboard";
        }
      } else {
        window.location.href = "/admin/login";
      }
    } catch (error) {
      console.error("Session verification failed:", error);
      window.location.href = "/admin/login";
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/users", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const result = await response.json();
        setUsers(result.data);
      } else {
        const error = await response.json();
        setError(error.error || "Failed to fetch users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleDeleteUser = (user) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setSuccess("User deleted successfully");
        fetchUsers();
        setShowDeleteDialog(false);
        setSelectedUser(null);
      } else {
        const error = await response.json();
        setError(error.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      setError("Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSuspendUser = (user) => {
    setSelectedUser(user);
    setSuspensionReason("");
    setShowSuspendDialog(true);
  };

  const handleUnsuspendUser = (user) => {
    setSelectedUser(user);
    setShowUnsuspendDialog(true);
  };

  const confirmSuspendUser = async () => {
    if (!selectedUser) return;
    if (!suspensionReason.trim()) {
      setError("Suspension reason is required");
      return;
    }
    setIsSuspending(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isSuspended: true,
          suspensionReason: suspensionReason.trim(),
        }),
      });
      if (response.ok) {
        setSuccess("User suspended successfully");
        fetchUsers();
        setShowSuspendDialog(false);
        setSelectedUser(null);
        setSuspensionReason("");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to suspend user");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to suspend user");
    } finally {
      setIsSuspending(false);
    }
  };

  const confirmUnsuspendUser = async () => {
    if (!selectedUser) return;
    setIsSuspending(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isSuspended: false }),
      });
      if (response.ok) {
        setSuccess("User unsuspended successfully");
        fetchUsers();
        setShowUnsuspendDialog(false);
        setSelectedUser(null);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to unsuspend user");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to unsuspend user");
    } finally {
      setIsSuspending(false);
    }
  };

  const handleResendActivation = async (user) => {
    setIsResendingActivation(true);
    try {
      const response = await fetch(`/api/users/${user.id}/resend-activation`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        setSuccess(`Activation email resent to ${user.fullName || user.email}`);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to resend activation email");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to resend activation email");
    } finally {
      setIsResendingActivation(false);
    }
  };

  const handleResetPassword = (user) => {
    setSelectedUser(user);
    setShowResetDialog(true);
  };

  const confirmResetPassword = async () => {
    if (!selectedUser) return;

    setIsResetting(true);
    try {
      const response = await fetch(
        `/api/users/${selectedUser.id}/reset-password`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        setSuccess(`Password reset email sent to ${selectedUser.fullName}`);
        setShowResetDialog(false);
        setSelectedUser(null);
      } else {
        const error = await response.json();
        setError(error.error || "Failed to send password reset email");
      }
    } catch (error) {
      console.error("Error sending password reset:", error);
      setError("Failed to send password reset email");
    } finally {
      setIsResetting(false);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingUser(null);
    setSuccess(
      editingUser ? "User updated successfully" : "User created successfully"
    );
    fetchUsers();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        window.location.href = "/admin/login";
      }
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.href = "/admin/login";
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "SUPERADMIN":
        return "bg-red-100 text-red-800";
      case "ADMIN":
        return "bg-blue-100 text-blue-800";
      case "EXAMINER":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getUserStatus = (user) => {
    if (user.isSuspended) return { label: "Suspended", color: "bg-red-100 text-red-800" };
    if (!user.isActivated) return { label: "Inactive", color: "bg-amber-100 text-amber-800" };
    return { label: "Active", color: "bg-green-100 text-green-800" };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <UserForm
        user={editingUser}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Navigation Header */}
      <NavigationHeader
        title="User Management"
        subtitle="Manage system users and permissions"
        icon="Users"
        showBackButton={true}
        backHref="/admin/dashboard"
        backText="Dashboard"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Users", href: "/admin/users" },
        ]}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-800">
            <CheckCircle className="w-5 h-5" />
            <span>{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <TableSearch
            query={usersTable.query}
            setQuery={usersTable.setQuery}
            placeholder="Search users..."
            filteredCount={usersTable.filteredCount}
            totalCount={usersTable.totalCount}
          />
          <button
            onClick={handleCreateUser}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created by
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usersTable.pageRows.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={onTableRowClick(() => setViewUserModal(user))}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.fullName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const status = getUserStatus(user);
                        return (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}
                            title={user.isSuspended && user.suspensionReason ? user.suspensionReason : undefined}
                          >
                            {status.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.creator ? user.creator.fullName : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center flex-wrap gap-1">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-900 transition-colors p-1"
                          disabled={user.isSuperadmin || user.cannotBeDeleted}
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {!user.isActivated && (
                          <button
                            onClick={() => handleResendActivation(user)}
                            className="text-amber-600 hover:text-amber-900 transition-colors p-1"
                            disabled={user.isSuperadmin || isResendingActivation}
                            title="Resend activation email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        {!user.isSuspended ? (
                          <button
                            onClick={() => handleSuspendUser(user)}
                            className="text-red-600 hover:text-red-900 transition-colors p-1"
                            disabled={user.isSuperadmin || user.cannotBeDeleted}
                            title="Suspend user"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnsuspendUser(user)}
                            className="text-green-600 hover:text-green-900 transition-colors p-1"
                            disabled={user.isSuperadmin || user.cannotBeDeleted}
                            title="Unsuspend user"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleResetPassword(user)}
                          className="text-purple-600 hover:text-purple-900 transition-colors p-1"
                          disabled={user.isSuperadmin || user.cannotBeDeleted}
                          title="Send password reset email"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 hover:text-red-900 transition-colors p-1"
                          disabled={user.isSuperadmin || user.cannotBeDeleted}
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager
            page={usersTable.page}
            setPage={usersTable.setPage}
            totalPages={usersTable.totalPages}
            filteredCount={usersTable.filteredCount}
            pageSize={usersTable.pageSize}
          />
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No users found
            </h3>
            <p className="text-gray-600">
              Get started by creating your first user.
            </p>
          </div>
        )}
      </main>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedUser(null);
        }}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete ${selectedUser?.fullName}? This action cannot be undone and will permanently remove the user from the system.`}
        type="danger"
        confirmText="Delete User"
        cancelText="Cancel"
        isLoading={isDeleting}
      />

      <ConfirmationDialog
        isOpen={showResetDialog}
        onClose={() => {
          setShowResetDialog(false);
          setSelectedUser(null);
        }}
        onConfirm={confirmResetPassword}
        title="Reset Password"
        message={`Send a password reset email to ${selectedUser?.fullName || selectedUser?.email}? They will receive a link to set a new password.`}
        type="info"
        confirmText="Send Reset Email"
        cancelText="Cancel"
        isLoading={isResetting}
      />

      {/* Suspend user dialog with reason */}
      {showSuspendDialog && selectedUser && (
        <div className="fixed inset-0 bg-gray-600/30 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Suspend User</h3>
              <p className="mt-1 text-sm text-gray-600">
                Suspend {selectedUser.fullName || selectedUser.email}? You must provide a reason (it will be stored and can be viewed later).
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suspension reason *
              </label>
              <textarea
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
                rows={3}
                placeholder="Enter reason for suspension..."
                disabled={isSuspending}
              />
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowSuspendDialog(false);
                  setSelectedUser(null);
                  setSuspensionReason("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={isSuspending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSuspendUser}
                disabled={isSuspending || !suspensionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSuspending ? "Suspending..." : "Suspend User"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={showUnsuspendDialog}
        onClose={() => {
          setShowUnsuspendDialog(false);
          setSelectedUser(null);
        }}
        onConfirm={confirmUnsuspendUser}
        title="Unsuspend User"
        message={`Unsuspend ${selectedUser?.fullName || selectedUser?.email}? Their suspension reason will be cleared and they will be able to log in again.`}
        type="info"
        confirmText="Unsuspend"
        cancelText="Cancel"
        isLoading={isSuspending}
      />

      {/* View User Modal */}
      {viewUserModal && (
        <div className="fixed inset-0 bg-gray-600/30 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
              <button
                type="button"
                onClick={() => setViewUserModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Name</span>
                <p className="text-gray-900 font-medium">{viewUserModal.fullName || [viewUserModal.firstName, viewUserModal.middleName, viewUserModal.lastName].filter(Boolean).join(" ") || "—"}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Email</span>
                <p className="text-gray-900">{viewUserModal.email}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Role</span>
                <p><span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getRoleColor(viewUserModal.role)}`}>{viewUserModal.role}</span></p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Status</span>
                <p><span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getUserStatus(viewUserModal).color}`}>{getUserStatus(viewUserModal).label}</span></p>
              </div>
              {viewUserModal.organisation && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase">Organisation</span>
                  <p className="text-gray-900">{viewUserModal.organisation}</p>
                </div>
              )}
              {viewUserModal.phone && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase">Contact</span>
                  <p className="text-gray-900">{viewUserModal.phone}</p>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Last Login</span>
                <p className="text-gray-900">{viewUserModal.lastLoginAt ? new Date(viewUserModal.lastLoginAt).toLocaleString() : "Never"}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Created</span>
                <p className="text-gray-900">{new Date(viewUserModal.createdAt).toLocaleString()}</p>
              </div>
              {viewUserModal.creator && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase">Created by</span>
                  <p className="text-gray-900">{viewUserModal.creator.fullName} {viewUserModal.creator.email && <span className="text-gray-500">({viewUserModal.creator.email})</span>}</p>
                </div>
              )}
              {viewUserModal.isSuspended && viewUserModal.suspensionReason && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase">Suspension Reason</span>
                  <p className="text-gray-900 mt-1 p-3 bg-red-50 rounded-lg border border-red-100">{viewUserModal.suspensionReason}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewUserModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
