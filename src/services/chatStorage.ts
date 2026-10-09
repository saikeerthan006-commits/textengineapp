import type { Message, Product } from "../types/agent";
import { supabase } from "./supabase";

export type SavedChat = {
  id: string;
  user_id: string;
  product: Product;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
};

function normalizeMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Message => Boolean(item && typeof item === "object" && (item as Message).role && typeof (item as Message).content === "string"))
    .map((item) => ({ ...item, activities: [], status: item.status === "error" ? "error" : "complete" }));
}

function chatTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();
  return firstUserMessage ? firstUserMessage.slice(0, 80) : "New chat";
}

export async function loadUserChats(userId: string): Promise<SavedChat[]> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.from("chat_conversations").select("id,user_id,product,title,messages,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, product: row.product as Product, messages: normalizeMessages(row.messages) }));
}

export async function saveUserChat(userId: string, chatId: string, product: Product, messages: Message[]): Promise<SavedChat> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const serializableMessages = messages.map((message) => ({ ...message, activities: [], status: message.status === "error" ? "error" : "complete" }));
  const { data, error } = await supabase.from("chat_conversations").upsert({
    id: chatId,
    user_id: userId,
    product,
    title: chatTitle(messages),
    messages: serializableMessages,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" }).select("id,user_id,product,title,messages,created_at,updated_at").single();
  if (error) throw error;
  return { ...data, product: data.product as Product, messages: normalizeMessages(data.messages) };
}
