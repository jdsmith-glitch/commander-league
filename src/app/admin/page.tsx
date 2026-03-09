"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, useAdmins } from "@/lib/hooks";

export default function AdminPage() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  const { authReady, leagueId } = useAuth(sb);
  const { adminUserIds, error, add } = useAdmins(sb, leagueId);

  async function handleAddAdmin() {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) return;

    setAddingAdmin(true);
    setAddError(null);
    try {
      await add(email);
      setNewAdminEmail("");
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddingAdmin(false);
    }
  }

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    window.location.href = "/login";
  }

  if (!sb || !authReady) {
    return <main style={{ padding: 30, fontFamily: "sans-serif" }}>Loading…</main>;
  }

  if (!leagueId) {
    return (
      <main style={{ padding: 30, fontFamily: "sans-serif" }}>
        <h1>No league found</h1>
        <button onClick={signOut}>Sign out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Admin Management</h1>
        <button
          onClick={() => (window.location.href = "/")}
          style={{
            color: "#1d4ed8",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textDecoration: "underline",
            font: "inherit",
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p>}
      {addError && <p style={{ color: "#b91c1c", marginTop: 10 }}>{addError}</p>}

      <section style={{ marginTop: 20 }}>
        <h2>Add Admin</h2>
        <p style={{ color: "#555", marginTop: 6 }}>
          Add other admins by email. They must <b>Sign up</b> first so their email exists in the system.
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <input
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddAdmin()}
            placeholder="admin@example.com"
            style={{ padding: 8, minWidth: 260 }}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button
            onClick={handleAddAdmin}
            disabled={addingAdmin}
            style={{
              color: "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: addingAdmin ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
            }}
          >
            {addingAdmin ? "Adding…" : "Add admin"}
          </button>
        </div>
      </section>

      <section style={{ marginTop: 30 }}>
        <h2>Current Admins</h2>
        {adminUserIds.length === 0 ? (
          <p style={{ color: "#555" }}>No admins yet.</p>
        ) : (
          <ul>
            {adminUserIds.map((id) => (
              <li key={id}>
                <code>{id}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={signOut}
        style={{
          marginTop: 30,
          color: "#1d4ed8",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textDecoration: "underline",
          font: "inherit",
        }}
      >
        Sign out
      </button>
    </main>
  );
}