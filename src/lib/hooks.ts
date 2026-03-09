import { useEffect, useState, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as queries from "./queries";
import type { Player, Season, GameRow, PodVM, LeaderboardStat } from "./queries";

export function useAuth(sb: SupabaseClient | null) {
  const [authReady, setAuthReady] = useState(false);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;

    sb.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        window.location.href = "/login";
        return;
      }
      setAuthReady(true);

      try {
        const lid = await queries.getOrCreateLeague(sb, data.session.user.id);
        setLeagueId(lid);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }, [sb]);

  return { authReady, leagueId, error };
}

export function usePlayers(sb: SupabaseClient | null, leagueId: string | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sb || !leagueId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await queries.getPlayers(sb, leagueId);
      setPlayers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sb, leagueId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (name: string) => {
      if (!sb || !leagueId) return;
      setError(null);
      try {
        await queries.addPlayer(sb, leagueId, name);
        await refresh();
      } catch (err: any) {
        setError(err.message);
      }
    },
    [sb, leagueId, refresh]
  );

  const remove = useCallback(
    async (playerId: string) => {
      if (!sb) return;
      setError(null);
      try {
        await queries.removePlayer(sb, playerId);
        await refresh();
      } catch (err: any) {
        setError(err.message);
      }
    },
    [sb, refresh]
  );

  return { players, loading, error, refresh, add, remove };
}

export function useSeasons(sb: SupabaseClient | null, leagueId: string | null) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sb || !leagueId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await queries.getSeasons(sb, leagueId);
      setSeasons(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sb, leagueId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (name: string) => {
      if (!sb || !leagueId) return;
      setError(null);
      try {
        await queries.addSeason(sb, leagueId, name);
        await refresh();
      } catch (err: any) {
        setError(err.message);
      }
    },
    [sb, leagueId, refresh]
  );

  const remove = useCallback(
    async (seasonId: string) => {
      if (!sb) return;
      setError(null);
      try {
        await queries.removeSeason(sb, seasonId);
        await refresh();
      } catch (err: any) {
        setError(err.message);
      }
    },
    [sb, refresh]
  );

  return { seasons, loading, error, refresh, add, remove };
}

export function useGames(sb: SupabaseClient | null, seasonId: string | null) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sb || !seasonId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await queries.getGamesBySeason(sb, seasonId);
      setGames(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sb, seasonId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async () => {
    if (!sb || !seasonId) return;
    setError(null);
    try {
      const nextNumber = (games.at(-1)?.game_number ?? 0) + 1;
      const newGame = await queries.addGame(sb, seasonId, nextNumber);
      setGames((prev) => [...prev, newGame].sort((a, b) => a.game_number - b.game_number));
    } catch (err: any) {
      setError(err.message);
    }
  }, [sb, seasonId, games]);

  const toggleLock = useCallback(
    async (gameId: string, currentLocked: boolean) => {
      if (!sb) return;
      setError(null);
      try {
        await queries.toggleGameLock(sb, gameId, currentLocked);
        await refresh();
      } catch (err: any) {
        setError(err.message);
      }
    },
    [sb, refresh]
  );

  return {
    games,
    loading,
    error,
    refresh,
    add,
    toggleLock,
  };
}

export function useGameAttendance(sb: SupabaseClient | null, gameId: string | null) {
  const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);
  const [byePlayerIds, setByePlayerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sb || !gameId) return;
    setLoading(true);
    setError(null);
    try {
      const [active, byes] = await Promise.all([
        queries.getGameActivePlayerIds(sb, gameId),
        queries.getGameByePlayerIds(sb, gameId),
      ]);
      setActivePlayerIds(active);
      setByePlayerIds(byes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sb, gameId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (playerId: string) => {
      if (!sb || !gameId) return;
      setError(null);
      try {
        const isActive = activePlayerIds.includes(playerId);
        await queries.toggleAttendance(sb, gameId, playerId, isActive);
        await refresh();
      } catch (err: any) {
        setError(err.message);
      }
    },
    [sb, gameId, activePlayerIds, refresh]
  );

  const selectAll = useCallback(
    async (playerIds: string[]) => {
      if (!sb || !gameId) return;
      setError(null);
      try {
        await queries.setGameActivePlayerIds(sb, gameId, playerIds);
        await refresh();
      } catch (err: any) {
        setError(err.message);
      }
    },
    [sb, gameId, refresh]
  );

  const clearAll = useCallback(async () => {
    if (!sb || !gameId) return;
    setError(null);
    try {
      await queries.setGameActivePlayerIds(sb, gameId, []);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [sb, gameId, refresh]);

  const carryFromPrevious = useCallback(async () => {
    if (!sb || !gameId) return;
    setError(null);
    try {
      const prevPlayerIds = await queries.getPreviousGameActivePlayerIds(sb, gameId);
      await queries.setGameActivePlayerIds(sb, gameId, prevPlayerIds);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [sb, gameId, refresh]);

  return {
    activePlayerIds,
    byePlayerIds,
    loading,
    error,
    refresh,
    toggle,
    selectAll,
    clearAll,
    carryFromPrevious,
  };
}

export function usePods(sb: SupabaseClient | null, gameId: string | null) {
  const [pods, setPods] = useState<PodVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sb || !gameId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await queries.getGamePods(sb, gameId);
      setPods(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sb, gameId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clear = useCallback(async () => {
    if (!sb || !gameId) return;
    setError(null);
    try {
      await queries.clearPods(sb, gameId);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }, [sb, gameId, refresh]);

  return { pods, setPods, loading, error, refresh, clear };
}

export function useSeasonLeaderboard(
  sb: SupabaseClient | null,
  seasonId: string | null,
  players: Player[],
  deps: any[] = []
) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardStat[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sb || !seasonId || players.length === 0) return;

    setLoading(true);
    queries
      .calculateSeasonLeaderboard(sb, seasonId, players)
      .then(setLeaderboard)
      .catch((err) => console.error("Leaderboard error:", err))
      .finally(() => setLoading(false));
  }, [sb, seasonId, players, ...deps]);

  return { leaderboard, loading };
}

export function useAdmins(sb: SupabaseClient | null, leagueId: string | null) {
  const [adminUserIds, setAdminUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sb || !leagueId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await queries.getAdminUserIds(sb, leagueId);
      setAdminUserIds(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sb, leagueId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (email: string) => {
      if (!sb || !leagueId) return;
      setError(null);
      try {
        await queries.addAdminByEmail(sb, leagueId, email);
        await refresh();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [sb, leagueId, refresh]
  );

  return { adminUserIds, loading, error, refresh, add };
}