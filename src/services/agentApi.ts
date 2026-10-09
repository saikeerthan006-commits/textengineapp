import type { AgentEvent, Product } from "../types/agent";
import { supabase } from "./supabase";

export async function streamAgentReply(input: { product: Product; message: string; performance: string; messages?: Array<{ role: "user" | "assistant"; content: string; artifacts?: Array<{ id: string; filename: string }> }>; web_search_enabled?: boolean; files?: File[]; signal?: AbortSignal }, onEvent: (event: AgentEvent) => void) {
  const { data: authData } = await supabase?.auth.getSession() ?? { data: { session: null } };
  if (!authData.session) throw new Error("Please sign in to continue.");
  const authorization = "Bearer " + authData.session.access_token;
  const uploaded: Array<{ path: string; filename: string }> = [];
  if (input.files?.length) {
    if (!supabase) throw new Error("Supabase file storage is not configured.");
    const signed = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify({ files: input.files.map((file) => ({ name: file.name, size: file.size, type: file.type })) }),
      signal: input.signal,
    });
    const signedBody = await signed.json().catch(() => null) as { error?: string; uploads?: Array<{ path: string; token: string; bucket: string; filename: string }> } | null;
    if (!signed.ok || !signedBody?.uploads || signedBody.uploads.length !== input.files.length) throw new Error(signedBody?.error || "Could not prepare secure file uploads.");
    for (const [index, file] of input.files.entries()) {
      const target = signedBody.uploads[index];
      const { error } = await supabase.storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file, { contentType: file.type || "application/octet-stream" });
      if (error) throw new Error("Could not upload " + file.name + ": " + error.message);
      uploaded.push({ path: target.path, filename: target.filename });
    }
  }
  const body = { product: input.product, message: input.message, performance: input.performance, messages: input.messages, web_search_enabled: input.web_search_enabled, uploads: uploaded };
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: authorization },
    body: JSON.stringify(body),
    signal: input.signal,
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || "Unable to reach the AI service.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const payload = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      if (payload) onEvent(JSON.parse(payload) as AgentEvent);
    }
    if (done) break;
  }
}
