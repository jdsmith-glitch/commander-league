import type { SupabaseClient } from "@supabase/supabase-js";

export type Player = { id: string; name: string };
export type Season = { id: string; name: string; league_id: string };
export type GameRow = { id: string; game_number: number; season_id: string; locked: boolean };
export type PodResultStatus = "pending" | "draw" | "win";

export type PodVM = {
  id: string;
  podNumber: number;
  playerIds: string[];
  status: PodResultStatus;
  winnerId: string | null;
  noShowIds: string[];
};

export type LeaderboardStat = {
  playerId: string;
  name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  byes: number;
  noShows: number;
  played: number;
};

export const SCORING = { win: 5, draw: 2, loss: 1, noShow: 0 };

// ========== LEAGUES ==========
export async function getOrCreateLeague(sb: SupabaseClient, userId: string) {
  const { data: adminRows, error } = await sb
    .from("league_admins")
    .select("league_id")
    .limit(1);

  if (error) throw new Error(error.message);
  if (adminRows && adminRows.length > 0) return adminRows[0].league_id;
  return null;
}

// ========== SEASONS ==========
export async function getSeasons(sb: SupabaseClient, leagueId: string): Promise<Season[]> {
  const { data, error } = await sb
    .from("seasons")
    .select("id,name,league_id")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Season[];
}

export async function addSeason(sb: SupabaseClient, leagueId: string, name: string) {
  const { data, error } = await sb
    .from("seasons")
    .insert({ league_id: leagueId, name })
    .select("id,name,league_id")
    .single();

  if (error) throw new Error(error.message);
  return data as Season;
}

export async function removeSeason(sb: SupabaseClient, seasonId: string) {
  const { error } = await sb.from("seasons").delete().eq("id", seasonId);
  if (error) throw new Error(error.message);
}

// ========== PLAYERS ==========
export async function getPlayers(sb: SupabaseClient, leagueId: string): Promise<Player[]> {
  const { data, error } = await sb
    .from("players")
    .select("id,name")
    .eq("league_id", leagueId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Player[];
}

export async function addPlayer(sb: SupabaseClient, leagueId: string, name: string) {
  const { error } = await sb.from("players").insert({ league_id: leagueId, name });
  if (error) throw new Error(error.message);
}

export async function removePlayer(sb: SupabaseClient, playerId: string) {
  const { error } = await sb.from("players").delete().eq("id", playerId);
  if (error) throw new Error(error.message);
}

// ========== GAMES ==========
export async function getGamesBySeason(sb: SupabaseClient, seasonId: string): Promise<GameRow[]> {
  const { data, error } = await sb
    .from("games")
    .select("id,game_number,season_id,locked")
    .eq("season_id", seasonId)
    .order("game_number", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as GameRow[];
}

export async function addGame(sb: SupabaseClient, seasonId: string, gameNumber: number) {
  const { data, error } = await sb
    .from("games")
    .insert({ season_id: seasonId, game_number: gameNumber, locked: false })
    .select("id,game_number,season_id,locked")
    .single();

  if (error) throw new Error(error.message);
  return data as GameRow;
}

export async function toggleGameLock(sb: SupabaseClient, gameId: string, currentLocked: boolean) {
  const { error } = await sb.from("games").update({ locked: !currentLocked }).eq("id", gameId);
  if (error) throw new Error(error.message);
}

// ========== GAME ATTENDANCE ==========
export async function getGameActivePlayerIds(sb: SupabaseClient, gameId: string): Promise<string[]> {
  const { data, error } = await sb.from("game_active_players").select("player_id").eq("game_id", gameId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.player_id);
}

export async function getGameByePlayerIds(sb: SupabaseClient, gameId: string): Promise<string[]> {
  const { data, error } = await sb.from("game_byes").select("player_id").eq("game_id", gameId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.player_id);
}

export async function toggleAttendance(sb: SupabaseClient, gameId: string, playerId: string, isActive: boolean) {
  if (isActive) {
    const { error } = await sb.from("game_active_players").delete().eq("game_id", gameId).eq("player_id", playerId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("game_active_players").insert({ game_id: gameId, player_id: playerId });
    if (error) throw new Error(error.message);
  }
}

export async function setGameActivePlayerIds(sb: SupabaseClient, gameId: string, playerIds: string[]) {
  // Clear existing
  const { error: delErr } = await sb.from("game_active_players").delete().eq("game_id", gameId);
  if (delErr) throw new Error(delErr.message);

  // Insert new
  if (playerIds.length > 0) {
    const rows = playerIds.map((pid) => ({ game_id: gameId, player_id: pid }));
    const { error: insErr } = await sb.from("game_active_players").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
}

/**
 * Get active players from the previous game in the same season.
 * Useful for auto-carrying attendance forward.
 */
export async function getPreviousGameActivePlayerIds(
  sb: SupabaseClient,
  currentGameId: string
): Promise<string[]> {
  // Get current game's info
  const { data: currentGame, error: cgErr } = await sb
    .from("games")
    .select("game_number,season_id")
    .eq("id", currentGameId)
    .single();

  if (cgErr || !currentGame) return [];

  const prevGameNumber = currentGame.game_number - 1;
  if (prevGameNumber < 1) return [];

  // Get previous game in same season
  const { data: prevGame, error: pgErr } = await sb
    .from("games")
    .select("id")
    .eq("season_id", currentGame.season_id)
    .eq("game_number", prevGameNumber)
    .single();

  if (pgErr || !prevGame) return [];

  // Get active players from previous game
  return getGameActivePlayerIds(sb, prevGame.id);
}

export async function clearGameData(sb: SupabaseClient, gameId: string) {
  const delByes = await sb.from("game_byes").delete().eq("game_id", gameId);
  if (delByes.error) throw new Error(delByes.error.message);

  const delPods = await sb.from("pods").delete().eq("game_id", gameId);
  if (delPods.error) throw new Error(delPods.error.message);

  const delActive = await sb.from("game_active_players").delete().eq("game_id", gameId);
  if (delActive.error) throw new Error(delActive.error.message);
}

// ========== PODS ==========
export async function getGamePods(sb: SupabaseClient, gameId: string): Promise<PodVM[]> {
  const { data: podRows, error: podErr } = await sb
    .from("pods")
    .select("id,pod_number")
    .eq("game_id", gameId)
    .order("pod_number", { ascending: true });

  if (podErr) throw new Error(podErr.message);
  if (!podRows || podRows.length === 0) return [];

  const podIds = podRows.map((p) => p.id);

  const [pp, pr, pns] = await Promise.all([
    sb.from("pod_players").select("pod_id,player_id").in("pod_id", podIds),
    sb.from("pod_results").select("pod_id,status,winner_player_id").in("pod_id", podIds),
    sb.from("pod_no_shows").select("pod_id,player_id").in("pod_id", podIds),
  ]);

  if (pp.error) throw new Error(pp.error.message);
  if (pr.error) throw new Error(pr.error.message);
  if (pns.error) throw new Error(pns.error.message);

  const byPodPlayers = new Map<string, string[]>();
  (pp.data ?? []).forEach((r: any) => {
    const arr = byPodPlayers.get(r.pod_id) ?? [];
    arr.push(r.player_id);
    byPodPlayers.set(r.pod_id, arr);
  });

  const byPodNoShows = new Map<string, string[]>();
  (pns.data ?? []).forEach((r: any) => {
    const arr = byPodNoShows.get(r.pod_id) ?? [];
    arr.push(r.player_id);
    byPodNoShows.set(r.pod_id, arr);
  });

  const byPodResult = new Map<string, { status: PodResultStatus; winnerId: string | null }>();
  (pr.data ?? []).forEach((r: any) => {
    byPodResult.set(r.pod_id, {
      status: (r.status as PodResultStatus) ?? "pending",
      winnerId: r.winner_player_id ?? null,
    });
  });

  const assembled: PodVM[] = podRows.map((p) => {
    const res = byPodResult.get(p.id) ?? { status: "pending" as PodResultStatus, winnerId: null };
    return {
      id: p.id,
      podNumber: p.pod_number,
      playerIds: (byPodPlayers.get(p.id) ?? []).slice(),
      status: res.status,
      winnerId: res.winnerId,
      noShowIds: (byPodNoShows.get(p.id) ?? []).slice(),
    };
  });

  return assembled;
}

export async function clearPods(sb: SupabaseClient, gameId: string) {
  const delByes = await sb.from("game_byes").delete().eq("game_id", gameId);
  if (delByes.error) throw new Error(delByes.error.message);

  const delPods = await sb.from("pods").delete().eq("game_id", gameId);
  if (delPods.error) throw new Error(delPods.error.message);
}

export async function setPodStatus(sb: SupabaseClient, podId: string, status: PodResultStatus, pod: PodVM) {
  let winner: string | null = null;
  if (status === "win") {
    const eligible = pod.playerIds.filter((id) => !pod.noShowIds.includes(id));
    winner = pod.winnerId && eligible.includes(pod.winnerId) ? pod.winnerId : eligible[0] ?? null;
  }

  const { error } = await sb.from("pod_results").upsert({ pod_id: podId, status, winner_player_id: status === "win" ? winner : null });
  if (error) throw new Error(error.message);

  return winner;
}

export async function setPodWinner(sb: SupabaseClient, podId: string, winnerId: string) {
  const { error } = await sb.from("pod_results").upsert({ pod_id: podId, status: "win", winner_player_id: winnerId });
  if (error) throw new Error(error.message);
}

export async function toggleNoShow(sb: SupabaseClient, podId: string, playerId: string, pod: PodVM) {
  const isNoShow = pod.noShowIds.includes(playerId);

  if (isNoShow) {
    const { error } = await sb.from("pod_no_shows").delete().eq("pod_id", podId).eq("player_id", playerId);
    if (error) throw new Error(error.message);

    const nextNoShows = pod.noShowIds.filter((id) => id !== playerId);
    let nextWinner = pod.winnerId;

    if (pod.status === "win") {
      const eligible = pod.playerIds.filter((id) => !nextNoShows.includes(id));
      if (nextWinner && !eligible.includes(nextWinner)) nextWinner = eligible[0] ?? null;
      await sb.from("pod_results").upsert({ pod_id: podId, status: "win", winner_player_id: nextWinner });
    }

    return { nextNoShows, nextWinner };
  } else {
    const { error } = await sb.from("pod_no_shows").insert({ pod_id: podId, player_id: playerId });
    if (error) throw new Error(error.message);

    const nextNoShows = [...pod.noShowIds, playerId];
    let nextWinner = pod.winnerId;

    if (pod.status === "win") {
      const eligible = pod.playerIds.filter((id) => !nextNoShows.includes(id));
      if (nextWinner && !eligible.includes(nextWinner)) nextWinner = eligible[0] ?? null;
      await sb.from("pod_results").upsert({ pod_id: podId, status: "win", winner_player_id: nextWinner });
    }

    return { nextNoShows, nextWinner };
  }
}

// ========== POD GENERATION ==========
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function planPods34(n: number): { sizes: number[]; byes: number } {
  for (let byes = 0; byes <= 3; byes++) {
    const m = n - byes;
    if (m < 3) continue;
    for (let threes = 0; threes <= 10; threes++) {
      const remaining = m - 3 * threes;
      if (remaining < 0) break;
      if (remaining % 4 === 0) {
        const fours = remaining / 4;
        return { sizes: [...Array(fours).fill(4), ...Array(threes).fill(3)], byes };
      }
    }
  }
  const threes = Math.floor(n / 3);
  const used = threes * 3;
  return { sizes: Array(threes).fill(3), byes: n - used };
}

function scorePods(pods: string[][], pairCounts: Map<string, number>) {
  let score = 0;
  for (const pod of pods) {
    for (let i = 0; i < pod.length; i++) {
      for (let j = i + 1; j < pod.length; j++) {
        score += pairCounts.get(pairKey(pod[i], pod[j])) ?? 0;
      }
    }
  }
  return score;
}

function generateOptimizedPods34(activePlayerIds: string[], pairCounts: Map<string, number>, iterations: number) {
  const { sizes, byes } = planPods34(activePlayerIds.length);
  if (sizes.length === 0) return { pods: [] as string[][], byes: [] as string[], score: 0 };

  let bestPods: string[][] = [];
  let bestByes: string[] = [];
  let bestScore = Number.POSITIVE_INFINITY;

  for (let t = 0; t < iterations; t++) {
    const ids = shuffle(activePlayerIds);
    const byeIds = byes > 0 ? ids.slice(0, byes) : [];
    const seated = ids.slice(byes);

    const pods: string[][] = [];
    let idx = 0;
    for (const size of sizes) {
      pods.push(seated.slice(idx, idx + size));
      idx += size;
    }

    const s = scorePods(pods, pairCounts);
    if (s < bestScore) {
      bestScore = s;
      bestPods = pods;
      bestByes = byeIds;
      if (bestScore === 0) break;
    }
  }

  return { pods: bestPods, byes: bestByes, score: bestScore };
}

async function inChunks<T>(items: T[], chunkSize: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += chunkSize) {
    await fn(items.slice(i, i + chunkSize));
  }
}

export async function buildPairCountsForSeason(sb: SupabaseClient, seasonId: string, excludeGameId: string): Promise<Map<string, number>> {
  const { data: gameRows, error: gErr } = await sb.from("games").select("id").eq("season_id", seasonId);
  if (gErr) throw new Error(gErr.message);

  const gameIds = (gameRows ?? []).map((r: any) => r.id).filter((id: string) => id !== excludeGameId);
  if (gameIds.length === 0) return new Map();

  const { data: podRows, error: pErr } = await sb.from("pods").select("id").in("game_id", gameIds);
  if (pErr) throw new Error(pErr.message);

  const podIds = (podRows ?? []).map((r: any) => r.id);
  if (podIds.length === 0) return new Map();

  const counts = new Map<string, number>();

  await inChunks(podIds, 200, async (chunk) => {
    const { data: pp, error: ppErr } = await sb.from("pod_players").select("pod_id,player_id").in("pod_id", chunk);
    if (ppErr) throw new Error(ppErr.message);

    const byPod = new Map<string, string[]>();
    (pp ?? []).forEach((r: any) => {
      const arr = byPod.get(r.pod_id) ?? [];
      arr.push(r.player_id);
      byPod.set(r.pod_id, arr);
    });

    for (const ids of byPod.values()) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const k = pairKey(ids[i], ids[j]);
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
    }
  });

  return counts;
}

export async function generateAndSavePods(
  sb: SupabaseClient,
  gameId: string,
  seasonId: string,
  activePlayerIds: string[]
) {
  if (activePlayerIds.length < 3) {
    throw new Error("Need at least 3 active players to generate pods.");
  }

  // Clear existing
  await clearPods(sb, gameId);

  // Build pair counts
  const pairCounts = await buildPairCountsForSeason(sb, seasonId, gameId);

  // Generate pods
  const iterations = Math.min(1800, Math.max(500, activePlayerIds.length * 60));
  const { pods: genPods, byes: genByes, score } = generateOptimizedPods34(activePlayerIds, pairCounts, iterations);

  // Save byes
  if (genByes.length > 0) {
    const { error: bErr } = await sb.from("game_byes").insert(genByes.map((pid) => ({ game_id: gameId, player_id: pid })));
    if (bErr) throw new Error(bErr.message);
  }

  // Save pods
  const { data: insertedPods, error: insPodsErr } = await sb
    .from("pods")
    .insert(genPods.map((_, i) => ({ game_id: gameId, pod_number: i + 1 })))
    .select("id,pod_number");

  if (insPodsErr) throw new Error(insPodsErr.message);

  const inserted = (insertedPods ?? []) as { id: string; pod_number: number }[];
  if (inserted.length !== genPods.length) throw new Error("Pod insert mismatch. Try generating again.");

  const podPlayersRows: { pod_id: string; player_id: string }[] = [];
  const podResultsRows: { pod_id: string; status: PodResultStatus; winner_player_id: string | null }[] = [];

  inserted
    .slice()
    .sort((a, b) => a.pod_number - b.pod_number)
    .forEach((podRow, idx) => {
      const members = genPods[idx];
      members.forEach((pid) => podPlayersRows.push({ pod_id: podRow.id, player_id: pid }));
      podResultsRows.push({ pod_id: podRow.id, status: "pending", winner_player_id: null });
    });

  const { error: ppErr } = await sb.from("pod_players").insert(podPlayersRows);
  if (ppErr) throw new Error(ppErr.message);

  const { error: prErr } = await sb.from("pod_results").insert(podResultsRows);
  if (prErr) throw new Error(prErr.message);

  return score;
}

export async function saveManualPods(
  sb: SupabaseClient,
  gameId: string,
  activePlayerIds: string[],
  manualAssign: Record<string, string>,
  manualPodCount: number
) {
  // Validate
  for (const pid of activePlayerIds) {
    const v = manualAssign[pid];
    if (!v) {
      throw new Error("Every active player must be assigned to a pod or bye.");
    }
  }

  const computePodSizes = (assign: Record<string, string>, podCount: number) => {
    const sizes = Array.from({ length: podCount }, () => 0);
    let byes = 0;
    for (const pid of Object.keys(assign)) {
      const v = assign[pid];
      if (v === "bye") byes++;
      else {
        const idx = Number(v) - 1;
        if (!Number.isNaN(idx) && idx >= 0 && idx < podCount) sizes[idx]++;
      }
    }
    return { sizes, byes };
  };

  const { sizes, byes } = computePodSizes(manualAssign, manualPodCount);

  // Enforce 3–4 only
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    if (s === 0) continue;
    if (s !== 3 && s !== 4) {
      throw new Error(`Pod ${i + 1} has ${s} players. Pods must be exactly 3 or 4.`);
    }
  }

  // Build pod membership
  const podMembers: string[][] = [];
  const podNumbers: number[] = [];
  const byeIds: string[] = [];

  for (let i = 1; i <= manualPodCount; i++) {
    const members = activePlayerIds.filter((pid) => manualAssign[pid] === String(i));
    if (members.length === 0) continue;
    podNumbers.push(i);
    podMembers.push(members);
  }
  for (const pid of activePlayerIds) if (manualAssign[pid] === "bye") byeIds.push(pid);

  // Clear and write
  const delByes = await sb.from("game_byes").delete().eq("game_id", gameId);
  if (delByes.error) throw new Error(delByes.error.message);

  const delPods = await sb.from("pods").delete().eq("game_id", gameId);
  if (delPods.error) throw new Error(delPods.error.message);

  if (byeIds.length > 0) {
    const { error: bErr } = await sb
      .from("game_byes")
      .insert(byeIds.map((pid) => ({ game_id: gameId, player_id: pid })));
    if (bErr) throw new Error(bErr.message);
  }

  if (podMembers.length === 0) return byes;

  const { data: insertedPods, error: insPodsErr } = await sb
    .from("pods")
    .insert(podNumbers.map((n) => ({ game_id: gameId, pod_number: n })))
    .select("id,pod_number");

  if (insPodsErr) throw new Error(insPodsErr.message);

  const inserted = (insertedPods ?? []) as { id: string; pod_number: number }[];
  const podIdByNumber = new Map<number, string>();
  inserted.forEach((p) => podIdByNumber.set(p.pod_number, p.id));

  const podPlayersRows: { pod_id: string; player_id: string }[] = [];
  const podResultsRows: { pod_id: string; status: PodResultStatus; winner_player_id: string | null }[] = [];

  podNumbers.forEach((n, idx) => {
    const podId = podIdByNumber.get(n);
    if (!podId) return;
    const members = podMembers[idx];
    members.forEach((pid) => podPlayersRows.push({ pod_id: podId, player_id: pid }));
    podResultsRows.push({ pod_id: podId, status: "pending", winner_player_id: null });
  });

  const { error: ppErr } = await sb.from("pod_players").insert(podPlayersRows);
  if (ppErr) throw new Error(ppErr.message);

  const { error: prErr } = await sb.from("pod_results").insert(podResultsRows);
  if (prErr) throw new Error(prErr.message);

  return byes;
}

// ========== LEADERBOARD ==========
export async function calculateSeasonLeaderboard(
  sb: SupabaseClient,
  seasonId: string,
  players: Player[]
): Promise<LeaderboardStat[]> {
  const stats = new Map<string, LeaderboardStat>();

  players.forEach((p) =>
    stats.set(p.id, {
      playerId: p.id,
      name: p.name,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      byes: 0,
      noShows: 0,
      played: 0,
    })
  );

  // Get all games in season
  const { data: games } = await sb.from("games").select("id").eq("season_id", seasonId);
  const gameIds = (games ?? []).map((g: any) => g.id);
  if (gameIds.length === 0) {
    return Array.from(stats.values());
  }

  // Get all byes
  const { data: allByes } = await sb.from("game_byes").select("player_id").in("game_id", gameIds);
  (allByes ?? []).forEach((r: any) => {
    const s = stats.get(r.player_id);
    if (!s) return;
    s.points += SCORING.win;
    s.wins += 1;
    s.byes += 1;
    s.played += 1;
  });

  // Get all pods
  const { data: allPods } = await sb.from("pods").select("id").in("game_id", gameIds);
  const podIds = (allPods ?? []).map((p: any) => p.id);
  if (podIds.length === 0) {
    return Array.from(stats.values());
  }

  // Get pod players and results
  const { data: podPlayers } = await sb
    .from("pod_players")
    .select("pod_id,player_id")
    .in("pod_id", podIds);
  const { data: podResults } = await sb
    .from("pod_results")
    .select("pod_id,status,winner_player_id")
    .in("pod_id", podIds);

  const playersByPod = new Map<string, string[]>();
  (podPlayers ?? []).forEach((r: any) => {
    const arr = playersByPod.get(r.pod_id) ?? [];
    arr.push(r.player_id);
    playersByPod.set(r.pod_id, arr);
  });

  const resultByPod = new Map<string, any>();
  (podResults ?? []).forEach((r: any) => {
    resultByPod.set(r.pod_id, r);
  });

  // Aggregate results
  for (const [podId, playerIds] of playersByPod.entries()) {
    const result = resultByPod.get(podId);
    if (!result) continue;

    for (const pid of playerIds) {
      const s = stats.get(pid);
      if (!s) continue;

      s.played += 1;

      if (result.status === "pending") continue;

      if (result.status === "draw") {
        s.points += SCORING.draw;
        s.draws += 1;
        continue;
      }

      if (result.status === "win") {
        if (result.winner_player_id === pid) {
          s.points += SCORING.win;
          s.wins += 1;
        } else {
          s.points += SCORING.loss;
          s.losses += 1;
        }
      }
    }
  }

  const sorted = Array.from(stats.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });

  return sorted;
}

// ========== ADMINS ==========
export async function getAdminUserIds(sb: SupabaseClient, leagueId: string): Promise<string[]> {
  const { data, error } = await sb
    .from("league_admins")
    .select("user_id")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.user_id);
}

export async function addAdminByEmail(sb: SupabaseClient, leagueId: string, email: string) {
  const { data: prof, error: pErr } = await sb.from("profiles").select("id,email").eq("email", email).single();

  if (pErr) {
    throw new Error("Could not find that email. Make sure they have signed up (created an account) first.");
  }

  const userId = prof.id;
  const { error: insErr } = await sb.from("league_admins").insert({ league_id: leagueId, user_id: userId });

  if (insErr) {
    throw new Error(insErr.message);
  }
}