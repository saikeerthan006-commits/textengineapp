import { FormEvent, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

type Props = {
  client: SupabaseClient | null;
  connection: "checking" | "connected" | "error";
  configured: boolean;
  session: Session | null;
  onSignedIn: (session: Session) => void;
};

const floatingEmojis = ["💬", "🧠", "✨", "📄", "💡", "🪄", "📝", "🌱"];

export default function AuthScreen({ client, connection, configured, session, onSignedIn }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (signUpError) throw signUpError;
        if (data.session) onSignedIn(data.session);
        else setNotice("Check your email for the confirmation link, then sign in.");
      } else {
        const { data, error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        if (data.session) onSignedIn(data.session);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (session) return null;

  return (
    <main className="auth-screen">
      <div className="auth-floaters" aria-hidden="true">
        {floatingEmojis.map((emoji, index) => <span key={emoji} className={`auth-floater auth-floater-${index + 1}`}>{emoji}</span>)}
      </div>
      <section className="auth-layout">
        <div className="auth-brand">
          <h1 className="auth-wordmark">TexEngine</h1>
          <p>Your ideas, answers, and conversations—kept in sync with your account.</p>
        </div>
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => { setMode("signin"); setError(""); setNotice(""); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>Create account</button>
          </div>
          <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="auth-subtitle">{mode === "signin" ? "Sign in to continue to your chats." : "Your chats will be private to your account."}</p>
          <form className="auth-form" onSubmit={submit}>
            <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label>Password<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="auth-submit" type="submit" disabled={busy || !client || connection !== "connected"}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
          </form>
          <div className={`auth-connection auth-connection-${connection}`} role="status"><span />{!configured ? "Supabase is not configured for this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the deployment environment, then redeploy." : connection === "checking" ? "Checking secure account connection…" : connection === "connected" ? "Secure account service connected" : "Could not connect to Supabase"}</div>
        </div>
      </section>
      <p className="auth-footer">TexEngine can make mistakes. Check important information.</p>
    </main>
  );
}
