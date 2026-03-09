"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth, usePlayers, useGameAttendance, usePods } from "@/lib/hooks";
import * as queries from "@/lib/queries";

export default function PodsPage({ params }: { params: Promise<{ gameId: string }> }) {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [game, setGame] = useState<any>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  useEffect(() => {
    params.then((p) => setGameId(p.gameId));
  }, [params]);

  const { authReady, leagueId } = useAuth(sb);
  const { players } = usePlayers(sb, leagueId);
  const { activePlayerIds } = useGameAttendance(sb, gameId);
  const { pods, refresh: refreshPods, clear: clearPods } = usePods(sb, gameId);

  useEffect(() => {
    if (!sb || !gameId) return;

    const loadGame = async () => {
      try {
        const { data, error: err } = await sb
          .from("games")
          .select("id,game_number,season_id,locked")
          .eq("id", gameId)
          .single();

        if (err) throw err;
        setGame(data);
        setSeasonId(data.season_id);
      } catch (err: any) {
        setError(err.message);
      }
    };

    loadGame();
  }, [sb, gameId]);

  async function handleGeneratePods() {
    if (!sb || !gameId || !seasonId || activePlayerIds.length < 3) {
      setError("Need at least 3 active players to generate pods");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await queries.generateAndSavePods(sb, gameId, seasonId, activePlayerIds);
      await refreshPods();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearPods() {
    if (!sb || !gameId) return;
    setLoading(true);
    setError(null);
    try {
      await clearPods();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    window.location.href = "/login";
  }

  if (!sb || !authReady || !game) {
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
        <h1>Game {game.game_number} - Pods & Results</h1>
        <button
          onClick={() => (window.location.href = `/games/${gameId}`)}
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
          ← Back to Game
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p>}

      <section style={{ marginTop: 30 }}>
        <h2>Generate Pods</h2>
        <p style={{ color: "#555" }}>
          Active players: <b>{activePlayerIds.length}</b> (Need at least 3)
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={handleGeneratePods}
            disabled={loading || activePlayerIds.length < 3 || game.locked}
            style={{
              color: activePlayerIds.length < 3 || game.locked ? "#93c5fd" : "#166534",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: activePlayerIds.length < 3 || game.locked ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
              fontWeight: "bold",
            }}
          >
            {loading ? "Generating..." : "🎲 Generate Optimized Pods"}
          </button>
          {pods.length > 0 && (
            <button
              onClick={handleClearPods}
              disabled={loading || game.locked}
              style={{
                color: game.locked ? "#93c5fd" : "#dc2626",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: game.locked ? "not-allowed" : "pointer",
                textDecoration: "underline",
                font: "inherit",
              }}
            >
              Clear Pods
            </button>
          )}
        </div>
      </section>

      <section style={{ marginTop: 30 }}>
        <h2>Pods & Results</h2>
        {pods.length === 0 ? (
          <p style={{ color: "#555" }}>No pods generated yet. Generate pods above to get started.</p>
        ) : (
          <div>
            {pods.map((pod) => (
              <PodCard
                key={pod.id}
                pod={pod}
                gameId={gameId}
                sb={sb}
                players={players}
                gameLocked={game.locked}
                onUpdate={refreshPods}
              />
            ))}
          </div>
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

function PodCard({
  pod,
  gameId,
  sb,
  players,
  gameLocked,
  onUpdate,
}: {
  pod: any;
  gameId: string | null;
  sb: SupabaseClient | null;
  players: any[];
  gameLocked: boolean;
  onUpdate: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const playerNames = (ids: string[]) => ids.map((id) => players.find((p) => p.id === id)?.name || "Unknown").join(", ");

  async function handleStatusChange(status: "pending" | "draw" | "win") {
    if (!sb || !gameId) return;
    setLoading(true);
    setError(null);
    try {
      await queries.setPodStatus(sb, pod.id, status, pod);
      await onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetWinner(winnerId: string) {
    if (!sb) return;
    setLoading(true);
    setError(null);
    try {
      await queries.setPodWinner(sb, pod.id, winnerId);
      await onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleNoShow(playerId: string) {
    if (!sb) return;
    setLoading(true);
    setError(null);
    try {
      await queries.toggleNoShow(sb, pod.id, playerId, pod);
      await onUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3>Pod {pod.podNumber}</h3>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      <div style={{ marginTop: 10 }}>
        <p style={{ color: "#555", marginBottom: 8 }}>
          <b>Players:</b> {playerNames(pod.playerIds)}
        </p>
      </div>

      <div style={{ marginTop: 10 }}>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={pod.noShowIds.includes(pod.playerIds[0])}
            disabled={gameLocked}
            onChange={() => handleToggleNoShow(pod.playerIds[0])}
          />
          <span style={{ marginLeft: 6 }}>Player 1 No-Show</span>
        </label>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => handleStatusChange("pending")}
          disabled={loading || gameLocked}
          style={{
            background: pod.status === "pending" ? "#dbeafe" : "transparent",
            border: "1px solid #ddd",
            padding: "6px 12px",
            borderRadius: 4,
            cursor: gameLocked ? "not-allowed" : "pointer",
            opacity: gameLocked ? 0.5 : 1,
          }}
        >
          Pending
        </button>
        <button
          onClick={() => handleStatusChange("draw")}
          disabled={loading || gameLocked}
          style={{
            background: pod.status === "draw" ? "#dbeafe" : "transparent",
            border: "1px solid #ddd",
            padding: "6px 12px",
            borderRadius: 4,
            cursor: gameLocked ? "not-allowed" : "pointer",
            opacity: gameLocked ? 0.5 : 1,
          }}
        >
          Draw
        </button>
        <button
          onClick={() => handleStatusChange("win")}
          disabled={loading || gameLocked}
          style={{
            background: pod.status === "win" ? "#dbeafe" : "transparent",
            border: "1px solid #ddd",
            padding: "6px 12px",
            borderRadius: 4,
            cursor: gameLocked ? "not-allowed" : "pointer",
            opacity: gameLocked ? 0.5 : 1,
          }}
        >
          Win
        </button>
      </div>

      {pod.status === "win" && (
        <div style={{ marginTop: 12 }}>
          <p style={{ marginBottom: 8 }}>Winner:</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pod.playerIds.map((playerId: string) => (
              <button
                key={playerId}
                onClick={() => handleSetWinner(playerId)}
                disabled={loading || gameLocked}
                style={{
                  background: pod.winnerId === playerId ? "#86efac" : "transparent",
                  border: "1px solid #ddd",
                  padding: "6px 12px",
                  borderRadius: 4,
                  cursor: gameLocked ? "not-allowed" : "pointer",
                  opacity: gameLocked ? 0.5 : 1,
                }}
              >
                {players.find((p) => p.id === playerId)?.name || "Unknown"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}