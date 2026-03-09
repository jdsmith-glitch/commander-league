"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, usePlayers } from "@/lib/hooks";

export default function PlayersPage() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  const { authReady, leagueId } = useAuth(sb);
  const { players, error, add, remove } = usePlayers(sb, leagueId);

  async function handleAddPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;
    try {
      await add(name);
      setNewPlayerName("");
    } catch (err) {
      // error is already in hook
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
        <h1>Players</h1>
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

      <section style={{ marginTop: 20 }}>
        <h2>Add Player</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddPlayer()}
            placeholder="Player name"
            style={{ padding: 8, minWidth: 240 }}
          />
          <button
            onClick={handleAddPlayer}
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
            Add
          </button>
          <span style={{ color: "#555" }}>Total: {players.length}</span>
        </div>
      </section>

      <section style={{ marginTop: 30 }}>
        <h2>Registered Players</h2>
        {players.length === 0 ? (
          <p style={{ color: "#555" }}>No players yet. Add your first player above.</p>
        ) : (
          <ul style={{ marginTop: 12 }}>
            {players.map((p) => (
              <li key={p.id} style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{p.name}</span>
                <button
                  onClick={() => remove(p.id)}
                  style={{
                    color: "#dc2626",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textDecoration: "underline",
                    font: "inherit",
                  }}
                >
                  Remove
                </button>
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