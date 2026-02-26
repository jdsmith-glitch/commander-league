"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [sb, setSb] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Client-only init
    import("@/lib/supabaseClient").then(({ getSupabaseClient }) => {
      const client = getSupabaseClient();
      setSb(client);

      // If already logged in, go home
      client.auth.getSession().then(({ data }: any) => {
        if (data.session) window.location.href = "/";
      });
    });
  }, []);

  async function signIn() {
    if (!sb) return;
    setBusy(true);
    setMsg(null);

    const { error } = await sb.auth.signInWithPassword({ email, password });

    setBusy(false);
    if (error) setMsg(error.message);
    else window.location.href = "/";
  }

  async function signUp() {
    if (!sb) return;
    setBusy(true);
    setMsg(null);

    const { error } = await sb.auth.signUp({ email, password });

    setBusy(false);
    if (error) setMsg(error.message);
    else setMsg("Sign-up created. If email confirmation is enabled, check your email, then sign in.");
  }

  if (!sb) {
    return <main style={{ padding: 30, fontFamily: "sans-serif" }}>Loading…</main>;
  }

  return (
    <main style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 520 }}>
      <h1>League Admin Login</h1>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8 }}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8 }}
          placeholder="••••••••"
        />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={signIn} disabled={busy}>
          Sign in
        </button>
        <button onClick={signUp} disabled={busy}>
          Sign up
        </button>
      </div>

      {msg && <p style={{ marginTop: 14 }}>{msg}</p>}

      <p style={{ marginTop: 18, color: "#555" }}>
        If this is your first time, use Sign up, then Sign in.
      </p>
    </main>
  );
}