import { useState } from "react";
import type { SavedChat } from "../services/chatStorage";

export default function ChatHistorySidebar({ chats, activeId, onSelect, onClose, onNew }: {
  chats: SavedChat[]; activeId: string | null; onSelect: (chat: SavedChat) => void; onClose: () => void; onNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const today = new Date().setHours(0, 0, 0, 0);
  const groups = ["Today", "Previous 7 days", "Older chats"];
  const filtered = chats.filter((chat) => chat.title.toLowerCase().includes(query.toLowerCase()));
  const groupFor = (chat: SavedChat) => new Date(chat.updated_at).getTime() >= today ? "Today" : new Date(chat.updated_at).getTime() >= today - 7 * 86400000 ? "Previous 7 days" : "Older chats";
  return <>
    <button aria-label="Close chat sidebar" onClick={onClose} className="fixed inset-0 z-40 bg-black/20 md:hidden" />
    <aside aria-label="Chat history" className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 md:relative md:z-20">
      <div className="flex items-center justify-between px-5 py-5"><span className="text-lg font-semibold tracking-tight">TexEngine</span><button onClick={onClose} aria-label="Collapse sidebar" className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-200">✕</button></div>
      <button onClick={onNew} className="mx-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-zinc-200"><span aria-hidden="true">＋</span> New chat</button>
      <div className="px-3 py-3"><input aria-label="Search chats" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" /></div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((group) => { const items = filtered.filter((chat) => groupFor(chat) === group); return items.length ? <section key={group} className="mb-5"><h2 className="px-3 pb-2 pt-3 text-xs font-medium text-zinc-500">{group}</h2>{items.map((chat) => <button key={chat.id} onClick={() => onSelect(chat)} title={chat.title} aria-current={chat.id === activeId ? "page" : undefined} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-zinc-200/70 ${chat.id === activeId ? "bg-zinc-200/80 font-medium" : "text-zinc-700"}`}><span className="min-w-0 flex-1 truncate">{chat.title}</span><span className="text-[10px] text-zinc-400">{chat.product === "dev" ? "DEV" : ""}</span></button>)}</section> : null; })}
        {!filtered.length && <p className="px-3 py-6 text-sm text-zinc-500">{query ? "No matching chats." : "Your conversations will appear here."}</p>}
      </nav>
    </aside>
  </>;
}
