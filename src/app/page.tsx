"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";

type Player = { id: string; name: string };
type GameRow = { id: string; game_number: number; locked: boolean };

type PodResultStatus = "pending" | "draw" | "win";

type PodVM = {
  id: string;
  podNumber: number;
  playerIds: string[];
  status: PodResultStatus;
  winnerId: string | null;
  noShowIds: string[];
};

type Scoring = { win: number; draw: number; loss: number; noShow: number };
const scoring: Scoring = { win: 5, draw: 2, loss: 1, noShow: 0 };

// ---------- pairing optimizer (3/4 only) ----------
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

export default function Home() {
  const [sb, setSb] = useState<any>(null);

  const [authReady, setAuthReady] = useState(false);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);
  const [byePlayerIds, setByePlayerIds] = useState<string[]>([]);
  const [pods, setPods] = useState<PodVM[]>([]);
  const [lastGenScore, setLastGenScore] = useState<number | null>(null);

  // ----- Manual pod editor -----
const [manualMode, setManualMode] = useState(false);
const [manualPodCount, setManualPodCount] = useState(0);
// assignment value: "bye" or "1".."N"
const [manualAssign, setManualAssign] = useState<Record<string, string>>({});
const [manualErr, setManualErr] = useState<string | null>(null);

function computePodSizes(assign: Record<string, string>, podCount: number) {
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
}
  const [newPlayerName, setNewPlayerName] = useState("");

  // Admins UI
  const [adminUserIds, setAdminUserIds] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);

  // Client-only init
  useEffect(() => {
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => setSb(getSupabaseClient()));
  }, []);

  const playersById = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const selectedGame = useMemo(() => games.find((g) => g.id === selectedGameId) ?? null, [games, selectedGameId]);

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    window.location.href = "/login";
  }

  // ---- Auth + league discovery ----
  useEffect(() => {
    if (!sb) return;

    sb.auth.getSession().then(async ({ data }: any) => {
      if (!data.session) {
        window.location.href = "/login";
        return;
      }
      setAuthReady(true);

      const { data: adminRows, error }: any = await sb.from("league_admins").select("league_id").limit(1);
      if (error) {
        setMsg(error.message);
        return;
      }
      if (adminRows && adminRows.length > 0) setLeagueId(adminRows[0].league_id);
      else setLeagueId(null);
    });
  }, [sb]);

  // ---- Load players + games ----
  useEffect(() => {
    if (!sb || !leagueId) return;

    (async () => {
      setMsg(null);

      const { data: p, error: pErr }: any = await sb
        .from("players")
        .select("id,name")
        .eq("league_id", leagueId)
        .order("name", { ascending: true });

      if (pErr) return void setMsg(pErr.message);
      setPlayers((p ?? []) as Player[]);

      const { data: g, error: gErr }: any = await sb
        .from("games")
        .select("id,game_number,locked")
        .eq("league_id", leagueId)
        .order("game_number", { ascending: true });

      if (gErr) return void setMsg(gErr.message);

      const gamesList = (g ?? []) as GameRow[];

      if (gamesList.length === 0) {
        const { data: created, error: cErr }: any = await sb
          .from("games")
          .insert({ league_id: leagueId, game_number: 1, locked: false })
          .select("id,game_number,locked")
          .single();
        if (cErr) return void setMsg(cErr.message);

        setGames([created as GameRow]);
        setSelectedGameId((created as GameRow).id);
      } else {
        setGames(gamesList);
        setSelectedGameId((prev) => prev ?? gamesList[0].id);
      }
    })();
  }, [sb, leagueId]);

  // ---- Load selected game data ----
  async function loadSelectedGameData(gameId: string) {
    if (!sb) return;
    setMsg(null);

    const [{ data: a, error: aErr }, { data: b, error: bErr }] = await Promise.all([
      sb.from("game_active_players").select("player_id").eq("game_id", gameId),
      sb.from("game_byes").select("player_id").eq("game_id", gameId),
    ]);

    if (aErr) return void setMsg(aErr.message);
    if (bErr) return void setMsg(bErr.message);

    setActivePlayerIds((a ?? []).map((r: any) => r.player_id));
    setByePlayerIds((b ?? []).map((r: any) => r.player_id));

    const { data: podRows, error: podErr } = await sb
      .from("pods")
      .select("id,pod_number")
      .eq("game_id", gameId)
      .order("pod_number", { ascending: true });

    if (podErr) return void setMsg(podErr.message);

    const podList = (podRows ?? []) as { id: string; pod_number: number }[];
    if (podList.length === 0) {
      setPods([]);
      return;
    }

    const podIds = podList.map((p) => p.id);

    const [pp, pr, pns] = await Promise.all([
      sb.from("pod_players").select("pod_id,player_id").in("pod_id", podIds),
      sb.from("pod_results").select("pod_id,status,winner_player_id").in("pod_id", podIds),
      sb.from("pod_no_shows").select("pod_id,player_id").in("pod_id", podIds),
    ]);

    if (pp.error) return void setMsg(pp.error.message);
    if (pr.error) return void setMsg(pr.error.message);
    if (pns.error) return void setMsg(pns.error.message);

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

    const assembled: PodVM[] = podList.map((p) => {
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

    assembled.forEach((pod) =>
      pod.playerIds.sort((a, b) => (playersById.get(a)?.name ?? "").localeCompare(playersById.get(b)?.name ?? ""))
    );

    setPods(assembled);
  }

  useEffect(() => {
    if (!sb || !selectedGameId) return;
    loadSelectedGameData(selectedGameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, selectedGameId]);

  useEffect(() => {
  // When switching games or changing attendance, prep the manual editor defaults
  if (!selectedGameId) return;

  // If this game already has pods loaded, mirror them
  if (pods.length > 0 || byePlayerIds.length > 0) {
    const nextCount = Math.max(1, ...pods.map((p) => p.podNumber));
    const nextAssign: Record<string, string> = {};

    // Default all active to bye until assigned
    for (const pid of activePlayerIds) nextAssign[pid] = "bye";

    // Fill from existing pods
    for (const pod of pods) {
      for (const pid of pod.playerIds) nextAssign[pid] = String(pod.podNumber);
    }

    // Fill from byes
    for (const pid of byePlayerIds) nextAssign[pid] = "bye";

    setManualPodCount(nextCount);
    setManualAssign(nextAssign);
    setManualErr(null);
    return;
  }

  // Otherwise, create a reasonable blank default:
  // Estimate pod count as roughly active/4, minimum 1
  const est = Math.max(1, Math.ceil(activePlayerIds.length / 4));
  const nextAssign: Record<string, string> = {};
  for (const pid of activePlayerIds) nextAssign[pid] = "1";
  setManualPodCount(est);
  setManualAssign(nextAssign);
  setManualErr(null);
}, [selectedGameId, activePlayerIds, pods, byePlayerIds]);

  async function refreshPlayers() {
    if (!sb || !leagueId) return;
    const { data, error }: any = await sb
      .from("players")
      .select("id,name")
      .eq("league_id", leagueId)
      .order("name", { ascending: true });
    if (error) setMsg(error.message);
    else setPlayers((data ?? []) as Player[]);
  }

  async function refreshGames() {
    if (!sb || !leagueId) return;
    const { data, error }: any = await sb
      .from("games")
      .select("id,game_number,locked")
      .eq("league_id", leagueId)
      .order("game_number", { ascending: true });
    if (error) setMsg(error.message);
    else setGames((data ?? []) as GameRow[]);
  }

  async function addPlayer() {
    if (!sb || !leagueId) return;
    const name = newPlayerName.trim();
    if (!name) return;

    setMsg(null);
    const { error }: any = await sb.from("players").insert({ league_id: leagueId, name });
    if (error) return void setMsg(error.message);

    setNewPlayerName("");
    await refreshPlayers();
  }

  async function removePlayer(playerId: string) {
    if (!sb) return;
    setMsg(null);

    const { error }: any = await sb.from("players").delete().eq("id", playerId);
    if (error) return void setMsg(error.message);

    await refreshPlayers();
    setActivePlayerIds((prev) => prev.filter((id) => id !== playerId));
    setByePlayerIds((prev) => prev.filter((id) => id !== playerId));
  }

  async function addGame() {
    if (!sb || !leagueId) return;
    setMsg(null);

    const nextNumber = (games.at(-1)?.game_number ?? 0) + 1;
    const { data, error }: any = await sb
      .from("games")
      .insert({ league_id: leagueId, game_number: nextNumber, locked: false })
      .select("id,game_number,locked")
      .single();

    if (error) return void setMsg(error.message);

    const created = data as GameRow;
    setGames((prev) => [...prev, created].sort((a, b) => a.game_number - b.game_number));
    setSelectedGameId(created.id);
  }

  async function toggleGameLock() {
    if (!sb || !selectedGame) return;
    setMsg(null);

    const { error }: any = await sb.from("games").update({ locked: !selectedGame.locked }).eq("id", selectedGame.id);
    if (error) return void setMsg(error.message);

    await refreshGames();
  }

  async function toggleAttendance(playerId: string) {
    if (!sb || !selectedGameId) return;
    if (selectedGame?.locked) return;

    setMsg(null);
    const isActive = activePlayerIds.includes(playerId);

    if (isActive) {
      const { error }: any = await sb.from("game_active_players").delete().eq("game_id", selectedGameId).eq("player_id", playerId);
      if (error) return void setMsg(error.message);
      setActivePlayerIds((prev) => prev.filter((id) => id !== playerId));
    } else {
      const { error }: any = await sb.from("game_active_players").insert({ game_id: selectedGameId, player_id: playerId });
      if (error) return void setMsg(error.message);
      setActivePlayerIds((prev) => [...prev, playerId]);
    }

    setPods([]);
    setByePlayerIds([]);
    setLastGenScore(null);

    await sb.from("game_byes").delete().eq("game_id", selectedGameId);
    await sb.from("pods").delete().eq("game_id", selectedGameId);
  }

  async function selectAllAttendance() {
    if (!sb || !selectedGameId) return;
    if (selectedGame?.locked) return;

    setMsg(null);

    const { error: delErr }: any = await sb.from("game_active_players").delete().eq("game_id", selectedGameId);
    if (delErr) return void setMsg(delErr.message);

    if (players.length === 0) {
      setActivePlayerIds([]);
      return;
    }

    const rows = players.map((p) => ({ game_id: selectedGameId, player_id: p.id }));
    const { error: insErr }: any = await sb.from("game_active_players").insert(rows);
    if (insErr) return void setMsg(insErr.message);

    setActivePlayerIds(players.map((p) => p.id));

    setPods([]);
    setByePlayerIds([]);
    setLastGenScore(null);

    await sb.from("game_byes").delete().eq("game_id", selectedGameId);
    await sb.from("pods").delete().eq("game_id", selectedGameId);
  }

  async function clearAllAttendance() {
    if (!sb || !selectedGameId) return;
    if (selectedGame?.locked) return;

    setMsg(null);
    const { error }: any = await sb.from("game_active_players").delete().eq("game_id", selectedGameId);
    if (error) return void setMsg(error.message);

    setActivePlayerIds([]);

    setPods([]);
    setByePlayerIds([]);
    setLastGenScore(null);

    await sb.from("game_byes").delete().eq("game_id", selectedGameId);
    await sb.from("pods").delete().eq("game_id", selectedGameId);
  }

  async function buildPairCountsForLeague(excludeGameId: string): Promise<Map<string, number>> {
    if (!sb || !leagueId) return new Map();

    const { data: gameRows, error: gErr }: any = await sb.from("games").select("id").eq("league_id", leagueId);
    if (gErr) {
      setMsg(gErr.message);
      return new Map();
    }

    const gameIds = (gameRows ?? []).map((r: any) => r.id).filter((id: string) => id !== excludeGameId);
    if (gameIds.length === 0) return new Map();

    const { data: podRows, error: pErr }: any = await sb.from("pods").select("id").in("game_id", gameIds);
    if (pErr) {
      setMsg(pErr.message);
      return new Map();
    }

    const podIds = (podRows ?? []).map((r: any) => r.id);
    if (podIds.length === 0) return new Map();

    const counts = new Map<string, number>();

    await inChunks(podIds, 200, async (chunk) => {
      const { data: pp, error: ppErr }: any = await sb.from("pod_players").select("pod_id,player_id").in("pod_id", chunk);
      if (ppErr) {
        setMsg(ppErr.message);
        return;
      }

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

  async function generatePods() {
    if (!sb || !selectedGameId) return;
    if (selectedGame?.locked) return;

    if (activePlayerIds.length < 3) {
      setMsg("Need at least 3 active players to generate pods.");
      return;
    }

    setMsg(null);

    const delByes = await sb.from("game_byes").delete().eq("game_id", selectedGameId);
    if (delByes.error) return void setMsg(delByes.error.message);

    const delPods = await sb.from("pods").delete().eq("game_id", selectedGameId);
    if (delPods.error) return void setMsg(delPods.error.message);

    const pairCounts = await buildPairCountsForLeague(selectedGameId);

    const iterations = Math.min(1800, Math.max(500, activePlayerIds.length * 60));
    const { pods: genPods, byes: genByes, score } = generateOptimizedPods34(activePlayerIds, pairCounts, iterations);
    setLastGenScore(score);

    if (genByes.length > 0) {
      const { error: bErr }: any = await sb.from("game_byes").insert(genByes.map((pid) => ({ game_id: selectedGameId, player_id: pid })));
      if (bErr) return void setMsg(bErr.message);
    }

    const { data: insertedPods, error: insPodsErr }: any = await sb
      .from("pods")
      .insert(genPods.map((_, i) => ({ game_id: selectedGameId, pod_number: i + 1 })))
      .select("id,pod_number");

    if (insPodsErr) return void setMsg(insPodsErr.message);

    const inserted = (insertedPods ?? []) as { id: string; pod_number: number }[];
    if (inserted.length !== genPods.length) return void setMsg("Pod insert mismatch. Try generating again.");

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

    const { error: ppErr }: any = await sb.from("pod_players").insert(podPlayersRows);
    if (ppErr) return void setMsg(ppErr.message);

    const { error: prErr }: any = await sb.from("pod_results").insert(podResultsRows);
    if (prErr) return void setMsg(prErr.message);

    await loadSelectedGameData(selectedGameId);
  }
async function saveManualPods() {
  if (!sb || !selectedGameId) return;
  if (selectedGame?.locked) return;

  setManualErr(null);
  setMsg(null);

  if (manualPodCount < 1) {
    setManualErr("Create at least 1 pod.");
    return;
  }

  // Ensure every active player has an assignment
  for (const pid of activePlayerIds) {
    const v = manualAssign[pid];
    if (!v) {
      setManualErr("Every active player must be assigned to a pod or bye.");
      return;
    }
  }

  const { sizes, byes } = computePodSizes(manualAssign, manualPodCount);

  // Enforce 3–4 only (byes allowed)
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    if (s === 0) continue; // allow empty pod slots (we'll skip them)
    if (s !== 3 && s !== 4) {
      setManualErr(`Pod ${i + 1} has ${s} players. Pods must be exactly 3 or 4.`);
      return;
    }
  }

  // Build pod membership lists, skipping empties
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

  // Clear existing pods/byes for this game and write the new ones
  const delByes = await sb.from("game_byes").delete().eq("game_id", selectedGameId);
  if (delByes.error) return void setManualErr(delByes.error.message);

  const delPods = await sb.from("pods").delete().eq("game_id", selectedGameId);
  if (delPods.error) return void setManualErr(delPods.error.message);

  if (byeIds.length > 0) {
    const { error: bErr }: any = await sb
      .from("game_byes")
      .insert(byeIds.map((pid) => ({ game_id: selectedGameId, player_id: pid })));
    if (bErr) return void setManualErr(bErr.message);
  }

  if (podMembers.length === 0) {
    // No pods, just byes
    await loadSelectedGameData(selectedGameId);
    return;
  }

  // Insert pods with the original pod numbers you chose
  const { data: insertedPods, error: insPodsErr }: any = await sb
    .from("pods")
    .insert(podNumbers.map((n) => ({ game_id: selectedGameId, pod_number: n })))
    .select("id,pod_number");

  if (insPodsErr) return void setManualErr(insPodsErr.message);

  const inserted = (insertedPods ?? []) as { id: string; pod_number: number }[];
  // Map pod_number -> pod_id
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

  const { error: ppErr }: any = await sb.from("pod_players").insert(podPlayersRows);
  if (ppErr) return void setManualErr(ppErr.message);

  const { error: prErr }: any = await sb.from("pod_results").insert(podResultsRows);
  if (prErr) return void setManualErr(prErr.message);

  // Done — reload from DB so UI matches exactly
  await loadSelectedGameData(selectedGameId);
  setManualErr(`Saved. Pods: ${podMembers.length}, Byes: ${byes}.`);
}
  async function clearPods() {
    if (!sb || !selectedGameId) return;
    if (selectedGame?.locked) return;

    setMsg(null);

    const delByes = await sb.from("game_byes").delete().eq("game_id", selectedGameId);
    if (delByes.error) return void setMsg(delByes.error.message);

    const delPods = await sb.from("pods").delete().eq("game_id", selectedGameId);
    if (delPods.error) return void setMsg(delPods.error.message);

    setByePlayerIds([]);
    setPods([]);
    setLastGenScore(null);
  }

  async function setPodStatus(podId: string, status: PodResultStatus) {
    if (!sb) return;
    if (selectedGame?.locked) return;
    setMsg(null);

    let winner: string | null = null;
    if (status === "win") {
      const pod = pods.find((p) => p.id === podId);
      if (pod) {
        const eligible = pod.playerIds.filter((id) => !pod.noShowIds.includes(id));
        winner = pod.winnerId && eligible.includes(pod.winnerId) ? pod.winnerId : eligible[0] ?? null;
      }
    }

    const { error }: any = await sb.from("pod_results").upsert({ pod_id: podId, status, winner_player_id: status === "win" ? winner : null });
    if (error) return void setMsg(error.message);

    setPods((prev) => prev.map((p) => (p.id === podId ? { ...p, status, winnerId: status === "win" ? winner : null } : p)));
  }

  async function setPodWinner(podId: string, winnerId: string) {
    if (!sb) return;
    if (selectedGame?.locked) return;
    setMsg(null);

    const { error }: any = await sb.from("pod_results").upsert({ pod_id: podId, status: "win", winner_player_id: winnerId });
    if (error) return void setMsg(error.message);

    setPods((prev) => prev.map((p) => (p.id === podId ? { ...p, status: "win", winnerId } : p)));
  }

  async function toggleNoShow(podId: string, playerId: string) {
    if (!sb) return;
    if (selectedGame?.locked) return;
    setMsg(null);

    const pod = pods.find((p) => p.id === podId);
    if (!pod) return;

    const isNoShow = pod.noShowIds.includes(playerId);

    if (isNoShow) {
      const { error }: any = await sb.from("pod_no_shows").delete().eq("pod_id", podId).eq("player_id", playerId);
      if (error) return void setMsg(error.message);

      const nextNoShows = pod.noShowIds.filter((id) => id !== playerId);
      let nextWinner = pod.winnerId;

      if (pod.status === "win") {
        const eligible = pod.playerIds.filter((id) => !nextNoShows.includes(id));
        if (nextWinner && !eligible.includes(nextWinner)) nextWinner = eligible[0] ?? null;
        await sb.from("pod_results").upsert({ pod_id: podId, status: "win", winner_player_id: nextWinner });
      }

      setPods((prev) => prev.map((p) => (p.id === podId ? { ...p, noShowIds: nextNoShows, winnerId: nextWinner } : p)));
    } else {
      const { error }: any = await sb.from("pod_no_shows").insert({ pod_id: podId, player_id: playerId });
      if (error) return void setMsg(error.message);

      const nextNoShows = [...pod.noShowIds, playerId];
      let nextWinner = pod.winnerId;

      if (pod.status === "win") {
        const eligible = pod.playerIds.filter((id) => !nextNoShows.includes(id));
        if (nextWinner && !eligible.includes(nextWinner)) nextWinner = eligible[0] ?? null;
        await sb.from("pod_results").upsert({ pod_id: podId, status: "win", winner_player_id: nextWinner });
      }

      setPods((prev) => prev.map((p) => (p.id === podId ? { ...p, noShowIds: nextNoShows, winnerId: nextWinner } : p)));
    }
  }

  type Stat = {
    const [leaderboard, setLeaderboard] = useState<Stat[]>([]);
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
async function calculateLeagueLeaderboard() {
  if (!sb || !leagueId) return;

  const stats = new Map<string, Stat>();

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

  // 1️⃣ Get all games
  const { data: games } = await sb
    .from("games")
    .select("id")
    .eq("league_id", leagueId);

  const gameIds = (games ?? []).map((g: any) => g.id);
  if (gameIds.length === 0) {
    setLeaderboard(Array.from(stats.values()));
    return;
  }

  // 2️⃣ Get all byes
  const { data: allByes } = await sb
    .from("game_byes")
    .select("player_id")
    .in("game_id", gameIds);

  (allByes ?? []).forEach((r: any) => {
    const s = stats.get(r.player_id);
    if (!s) return;
    s.points += scoring.win;
    s.wins += 1;
    s.byes += 1;
    s.played += 1;
  });

  // 3️⃣ Get all pods
  const { data: allPods } = await sb
    .from("pods")
    .select("id")
    .in("game_id", gameIds);

  const podIds = (allPods ?? []).map((p: any) => p.id);
  if (podIds.length === 0) {
    setLeaderboard(Array.from(stats.values()));
    return;
  }

  // 4️⃣ Get pod players
  const { data: podPlayers } = await sb
    .from("pod_players")
    .select("pod_id,player_id")
    .in("pod_id", podIds);

  // 5️⃣ Get pod results
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

  // 6️⃣ Aggregate results
  for (const [podId, playerIds] of playersByPod.entries()) {
    const result = resultByPod.get(podId);
    if (!result) continue;

    for (const pid of playerIds) {
      const s = stats.get(pid);
      if (!s) continue;

      s.played += 1;

      if (result.status === "pending") continue;

      if (result.status === "draw") {
        s.points += scoring.draw;
        s.draws += 1;
        continue;
      }

      if (result.status === "win") {
        if (result.winner_player_id === pid) {
          s.points += scoring.win;
          s.wins += 1;
        } else {
          s.points += scoring.loss;
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

  setLeaderboard(sorted);
}

useEffect(() => {
  if (!sb || !leagueId || players.length === 0) return;
  calculateLeagueLeaderboard();
}, [sb, leagueId, players, pods, byePlayerIds]);

  // ---- Admins ----
  async function loadAdmins() {
    if (!sb || !leagueId) return;
    setAdminMsg(null);

    const { data, error }: any = await sb.from("league_admins").select("user_id").eq("league_id", leagueId).order("created_at", { ascending: true });
    if (error) return void setAdminMsg(error.message);

    setAdminUserIds((data ?? []).map((r: any) => r.user_id));
  }

  useEffect(() => {
    if (!sb || !leagueId) return;
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, leagueId]);

  async function addAdminByEmail() {
    if (!sb || !leagueId) return;
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) return;

    setAdminBusy(true);
    setAdminMsg(null);

    // Find user id by email via profiles
    const { data: prof, error: pErr }: any = await sb.from("profiles").select("id,email").eq("email", email).single();

    if (pErr) {
      setAdminBusy(false);
      setAdminMsg("Could not find that email. Make sure they have signed up (created an account) first.");
      return;
    }

    const userId = prof.id;

    const { error: insErr }: any = await sb.from("league_admins").insert({ league_id: leagueId, user_id: userId });

    setAdminBusy(false);

    if (insErr) {
      // Often "duplicate key" if already admin
      setAdminMsg(insErr.message);
      return;
    }

    setNewAdminEmail("");
    setAdminMsg("Admin added.");
    await loadAdmins();
  }

  if (!sb || !authReady) return <main style={{ padding: 30, fontFamily: "sans-serif" }}>Loading…</main>;

  if (!leagueId) {
    return (
      <main style={{ padding: 30, fontFamily: "sans-serif" }}>
        <h1>Commander League Manager</h1>
        <p style={{ color: "#b91c1c" }}>No league found for your account.</p>
        <button onClick={signOut}>Sign out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 1100 }}>
      <h1>Commander League Manager</h1>

      <p style={{ marginTop: 6 }}>
        <button
          onClick={signOut}
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
          Sign out
        </button>
      </p>

      {msg && <p style={{ marginTop: 10, color: "#b91c1c" }}>{msg}</p>}

      <hr style={{ margin: "22px 0" }} />

      <section>
        <h2>Players</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Player name" style={{ padding: 8, minWidth: 240 }} />
          <button
            onClick={addPlayer}
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

        <ul style={{ marginTop: 12 }}>
          {players.map((p) => (
            <li key={p.id} style={{ marginBottom: 6 }}>
              {p.name}{" "}
              <button
                onClick={() => removePlayer(p.id)}
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
      </section>

      <hr style={{ margin: "22px 0" }} />

      <section>
        <h2>Games</h2>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            Game:{" "}
            <select value={selectedGameId ?? ""} onChange={(e) => setSelectedGameId(e.target.value)}>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  Game {g.game_number}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={addGame}
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
            + Add Game
          </button>

          <span>
            Status: <b>{selectedGame?.locked ? "Locked" : "Open"}</b>
          </span>

          <button
            onClick={toggleGameLock}
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
            {selectedGame?.locked ? "Unlock Game" : "Lock Game"}
          </button>
        </div>

        <h3 style={{ marginTop: 18 }}>Attendance</h3>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={selectAllAttendance}
            disabled={!!selectedGame?.locked}
            style={{
              color: selectedGame?.locked ? "#93c5fd" : "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: selectedGame?.locked ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
            }}
          >
            Select All
          </button>

          <button
            onClick={clearAllAttendance}
            disabled={!!selectedGame?.locked}
            style={{
              color: selectedGame?.locked ? "#93c5fd" : "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: selectedGame?.locked ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
            }}
          >
            Clear All
          </button>

          <span style={{ color: "#555" }}>
            Active: <b>{activePlayerIds.length}</b>
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
          {players.map((p) => {
            const checked = activePlayerIds.includes(p.id);
            return (
              <label
                key={p.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  borderRadius: 8,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  opacity: selectedGame?.locked ? 0.7 : 1,
                }}
              >
                <input type="checkbox" checked={checked} disabled={!!selectedGame?.locked} onChange={() => toggleAttendance(p.id)} />
                <span>{p.name}</span>
              </label>
            );
          })}
        </div>

        <hr style={{ margin: "22px 0" }} />

        <h3>Pods</h3>

        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={generatePods}
            disabled={!!selectedGame?.locked || activePlayerIds.length < 3}
            style={{
              color: !!selectedGame?.locked || activePlayerIds.length < 3 ? "#93c5fd" : "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: !!selectedGame?.locked || activePlayerIds.length < 3 ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
            }}
          >
            Generate Pods (3–4 only, minimize repeats)
          </button>

          <button
            onClick={clearPods}
            disabled={!!selectedGame?.locked}
            style={{
              color: !!selectedGame?.locked ? "#93c5fd" : "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: !!selectedGame?.locked ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
            }}
          >
            Clear Pods
          </button>

<div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <input
      type="checkbox"
      checked={manualMode}
      disabled={!!selectedGame?.locked}
      onChange={() => setManualMode((v) => !v)}
    />
    <b>Manual Edit Pods (for backfilling games)</b>
  </label>

  {manualMode && (
    <>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button
          onClick={() => setManualPodCount((n) => Math.max(1, n + 1))}
          disabled={!!selectedGame?.locked}
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
          + Add Pod
        </button>

        <button
          onClick={() => setManualPodCount((n) => Math.max(1, n - 1))}
          disabled={!!selectedGame?.locked}
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
          − Remove Pod
        </button>

        <span style={{ color: "#555" }}>
          Pods available: <b>{manualPodCount}</b>
        </span>

        <button
          onClick={saveManualPods}
          disabled={!!selectedGame?.locked}
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
          Save Pods
        </button>
      </div>

      {manualErr && <p style={{ marginTop: 10, color: manualErr.startsWith("Saved") ? "#166534" : "#b91c1c" }}>{manualErr}</p>}

      <div style={{ marginTop: 10 }}>
        <b>Assign active players</b>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginTop: 8 }}>
          {activePlayerIds
            .slice()
            .sort((a, b) => (playersById.get(a)?.name ?? "").localeCompare(playersById.get(b)?.name ?? ""))
            .map((pid) => (
              <label key={pid} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>{playersById.get(pid)?.name ?? "Unknown"}</span>
                <select
                  value={manualAssign[pid] ?? "bye"}
                  onChange={(e) => setManualAssign((prev) => ({ ...prev, [pid]: e.target.value }))}
                >
                  <option value="bye">Bye</option>
                  {Array.from({ length: manualPodCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Pod {n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>

        {(() => {
          const { sizes, byes } = computePodSizes(manualAssign, manualPodCount);
          const bad = sizes
            .map((s, i) => ({ s, i }))
            .filter((x) => x.s !== 0 && x.s !== 3 && x.s !== 4);
          return (
            <div style={{ marginTop: 10, color: bad.length ? "#b91c1c" : "#555" }}>
              <b>Pod sizes:</b>{" "}
              {sizes
                .map((s, i) => (s === 0 ? null : `Pod ${i + 1}: ${s}`))
                .filter(Boolean)
                .join(" • ") || "none"}{" "}
              • <b>Byes:</b> {byes}
              {bad.length > 0 && <div style={{ marginTop: 6 }}>Each pod must be exactly 3 or 4 players.</div>}
            </div>
          );
        })()}
      </div>
    </>
  )}
</div>

          {lastGenScore !== null && (
            <span style={{ color: "#555" }}>
              Repeat score: <b>{lastGenScore}</b> (lower = fewer repeats)
            </span>
          )}
        </div>

        {byePlayerIds.length > 0 && (
          <p style={{ marginTop: 10 }}>
            <b>Byes (count as win +{scoring.win}):</b> {byePlayerIds.map((id) => playersById.get(id)?.name ?? "Unknown").join(", ")}
          </p>
        )}

        {pods.length === 0 ? (
          <p style={{ marginTop: 10, color: "#555" }}>No pods yet. Generate pods to start.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12, marginTop: 12 }}>
            {pods
              .slice()
              .sort((a, b) => a.podNumber - b.podNumber)
              .map((pod) => {
                const eligible = pod.playerIds.filter((id) => !pod.noShowIds.includes(id));
                return (
                  <div key={pod.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <b>Pod {pod.podNumber}</b>
                      <span style={{ color: "#555" }}>{pod.playerIds.length} players</span>
                    </div>

                    <ul style={{ marginTop: 8 }}>
                      {pod.playerIds.map((pid) => (
                        <li key={pid}>
                          {playersById.get(pid)?.name ?? "Unknown"}{" "}
                          {pod.noShowIds.includes(pid) && <span style={{ color: "#b91c1c" }}>(no-show)</span>}
                        </li>
                      ))}
                    </ul>

                    <hr style={{ margin: "12px 0" }} />

                    <b>Result</b>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                      <label>
                        Status:{" "}
                        <select value={pod.status} disabled={!!selectedGame?.locked} onChange={(e) => setPodStatus(pod.id, e.target.value as PodResultStatus)}>
                          <option value="pending">Pending</option>
                          <option value="draw">Draw</option>
                          <option value="win">Win</option>
                        </select>
                      </label>

                      {pod.status === "win" && (
                        <label>
                          Winner:{" "}
                          <select value={pod.winnerId ?? ""} disabled={!!selectedGame?.locked} onChange={(e) => setPodWinner(pod.id, e.target.value)}>
                            {eligible.map((pid) => (
                              <option key={pid} value={pid}>
                                {playersById.get(pid)?.name ?? "Unknown"}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <b>No-shows</b>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                        {pod.playerIds.map((pid) => (
                          <label key={pid} style={{ opacity: selectedGame?.locked ? 0.7 : 1 }}>
                            <input type="checkbox" disabled={!!selectedGame?.locked} checked={pod.noShowIds.includes(pid)} onChange={() => toggleNoShow(pod.id, pid)} />{" "}
                            {playersById.get(pid)?.name ?? "Unknown"}
                          </label>
                        ))}
                      </div>
                      <p style={{ marginTop: 8, color: "#555" }}>No-show overrides other outcomes for that player.</p>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      <hr style={{ margin: "22px 0" }} />

      <section>
        <h2>Leaderboard</h2>
        <p style={{ color: "#555", marginTop: 6 }}>
          Scoring: Win {scoring.win}, Draw {scoring.draw}, Loss {scoring.loss}, No-show {scoring.noShow}. Byes count as wins.
        </p>

        {players.length === 0 ? (
          <p>No players yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["Rank", "Player", "Points", "W", "D", "L", "Byes", "No-shows", "Played"].map((h) => (
                    <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.playerId}>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{i + 1}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{r.name}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      <b>{r.points}</b>
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{r.wins}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{r.draws}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{r.losses}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{r.byes}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{r.noShows}</td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f0f0f0" }}>{r.played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <hr style={{ margin: "22px 0" }} />

      {/* ADMINS PANEL */}
      <section>
        <h2>Admins</h2>
        <p style={{ color: "#555", marginTop: 6 }}>
          Add other admins by email. They must <b>Sign up</b> first so their email exists in the system.
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <input
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="admin@example.com"
            style={{ padding: 8, minWidth: 260 }}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button
            onClick={addAdminByEmail}
            disabled={adminBusy}
            style={{
              color: "#1d4ed8",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: adminBusy ? "not-allowed" : "pointer",
              textDecoration: "underline",
              font: "inherit",
            }}
          >
            {adminBusy ? "Adding…" : "Add admin"}
          </button>

          <button
            onClick={loadAdmins}
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
            Refresh admin list
          </button>
        </div>

        {adminMsg && <p style={{ marginTop: 10, color: adminMsg.includes("added") ? "#166534" : "#b91c1c" }}>{adminMsg}</p>}

        <div style={{ marginTop: 12 }}>
          <b>Current admin user IDs</b>
          <ul>
            {adminUserIds.map((id) => (
              <li key={id}>
                <code>{id}</code>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}