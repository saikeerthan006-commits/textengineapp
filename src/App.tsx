import ChatHistorySidebar from "./components/ChatHistorySidebar";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import AgentPanel from "./components/AgentPanel";
import ChatInput from "./components/ChatInput";
import AuthScreen from "./components/AuthScreen";
import { streamAgentReply } from "./services/agentApi";
import type { ActivityEvent, Message, Product } from "./types/agent";
import { supabase, supabaseConfigured, supabaseConnectionUrl, supabasePublishableKey } from "./services/supabase";
import { loadUserChats, saveUserChat, type SavedChat } from "./services/chatStorage";
import type { Session } from "@supabase/supabase-js";
import texDevLogo from "./assets/texdev-logo.png";
import texEngineLogo from "./assets/texengine-logo.png";

type IconProps = {
  className?: string;
};

type Model = {
  id: "engine" | "dev";
  name: string;
  description: string;
  logo: string;
  accent: string;
};

const models: Model[] = [
  {
    id: "engine",
    name: "TexEngine",
    description: "Fast, capable answers for everyday tasks",
    logo: texEngineLogo,
    accent: "bg-lime-500",
  },
  {
    id: "dev",
    name: "TexDEV",
    description: "Advanced reasoning for code and technical work",
    logo: texDevLogo,
    accent: "bg-blue-500",
  },
];

const suggestions = [
  {
    value: "Low",
    description: "Low credit consumption for quick, simple responses",
  },
  {
    value: "Medium",
    description: "Balanced performance and credit consumption",
  },
  {
    value: "High",
    description: "Detailed responses for complex requests",
  },
  { value: "Max", description: "Rich visuals, polished files, and deeper chat context" },
];

const rotatingPrompts = {
  engine: [
    "WHAT TO COOK?",
    "ASK ANYTHING. BUILD SOMETHING.",
    "TURN YOUR IDEAS INTO ANSWERS.",
  ],
  dev: [
    "WHAT TO CODE?",
    "DEBUG. BUILD. SHIP.",
    "LET'S TURN IDEAS INTO SOFTWARE.",
  ],
};

function useTypewriter(phrases: string[]) {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setText("");
    setPhraseIndex(0);
    setIsDeleting(false);
  }, [phrases]);

  useEffect(() => {
    const target = phrases[phraseIndex];
    let delay = isDeleting ? 38 : 68;

    if (!isDeleting && text === target) {
      delay = 1600;
    } else if (isDeleting && text === "") {
      delay = 280;
    }

    const timer = window.setTimeout(() => {
      if (!isDeleting && text === target) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && text === "") {
        setIsDeleting(false);
        setPhraseIndex((current) => (current + 1) % phrases.length);
        return;
      }

      setText(
        target.slice(0, isDeleting ? text.length - 1 : text.length + 1),
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isDeleting, phraseIndex, phrases, text]);

  return text;
}

function mergeActivity(activities: ActivityEvent[], next: ActivityEvent) {
  const sameId = activities.findIndex((item) => item.id === next.id);
  if (sameId >= 0) return activities.map((item, index) => index === sameId ? next : item);
  if (next.status === "running") {
    return [...activities.map((item) => item.status === "running" ? { ...item, status: "complete" as const } : item), next];
  }
  let matchingRunning = -1;
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    if (activities[index].message === next.message && activities[index].status === "running") { matchingRunning = index; break; }
  }
  if (matchingRunning >= 0) {
    return activities.map((item, index) => index === matchingRunning ? { ...next, id: item.id } : item);
  }
  return [...activities, next];
}

function IconButton({
  children,
  label,
  className = "",
  onClick,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid size-10 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 ${className}`}
    >
      {children}
    </button>
  );
}

function Logo({ model, compact = false }: { model: Model; compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-zinc-200 bg-white ${
        compact ? "h-8 w-11" : "h-10 w-16"
      }`}
    >
      <img
        src={model.logo}
        alt={`${model.name} logo`}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    </div>
  );
}

function ModelPicker({
  selected,
  onSelect,
}: {
  selected: Model;
  onSelect: (model: Model) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 items-center gap-2 rounded-xl border border-transparent px-2 text-left transition duration-200 hover:border-zinc-200 hover:bg-white hover:shadow-sm active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
      >
        <Logo model={selected} compact />
        <span className="hidden text-sm font-semibold text-zinc-900 sm:block">
          {selected.name}
        </span>
        <ChevronDownIcon
          className={`size-4 text-zinc-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choose a model"
          className="dropdown-enter absolute left-0 top-[calc(100%+0.5rem)] z-50 w-80 origin-top-left overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl shadow-zinc-900/10"
        >
          <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Choose a model
          </div>
          {models.map((model) => {
            const isSelected = model.id === selected.id;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={model.id}
                onClick={() => {
                  onSelect(model);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition duration-150 active:scale-[0.98] ${
                  isSelected ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                <Logo model={model} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    {model.name}
                    {model.id === "engine" && (
                      <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-700">
                        Default
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                    {model.description}
                  </span>
                </span>
                {isSelected && (
                  <CheckIcon className="size-5 shrink-0 text-lime-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PerformancePicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="relative" ref={pickerRef}>
      {open && (
        <div
          role="listbox"
          aria-label="Select model performance"
          className="dropdown-enter-up absolute bottom-[calc(100%+0.5rem)] left-0 z-40 w-80 origin-bottom-left rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl shadow-zinc-900/10"
        >
          <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Model performance
          </div>
          {suggestions.map((option) => {
            const isSelected = option.value === selected;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={option.value}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition duration-150 active:scale-[0.98] ${
                  isSelected ? "bg-lime-50" : "hover:bg-zinc-50"
                }`}
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    option.value === "Low"
                      ? "bg-lime-400"
                      : option.value === "Medium"
                        ? "bg-amber-400"
                        : "bg-blue-500"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900">
                    {option.value}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                    {option.description}
                  </span>
                </span>
                {isSelected && (
                  <CheckIcon className="mt-0.5 size-5 shrink-0 text-lime-600" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-left transition duration-200 hover:bg-zinc-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
      >
        <ChevronDownIcon
          className={`size-4 text-zinc-500 transition-transform ${
            open ? "" : "rotate-180"
          }`}
        />
        <span>
          <span className="block text-[11px] font-bold tracking-wide text-zinc-700">
            {selected.toUpperCase()}
          </span>
        </span>
      </button>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authPending, setAuthPending] = useState(true);
  const [supabaseConnection, setSupabaseConnection] = useState<"checking" | "connected" | "error">("checking");
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [performance, setPerformance] = useState(() => {
    try {
      const saved = window.localStorage.getItem("texdev-performance");
      return ["Low", "Medium", "High", "Max"].includes(saved ?? "") ? saved ?? "Low" : "Low";
    } catch {
      return "Low";
    }
  });
  const [drafts, setDrafts] = useState<Record<Product, string>>({ engine: "", dev: "" });
  const [conversations, setConversations] = useState<Record<Product, Message[]>>({ engine: [], dev: [] });
  const [activeChatIds, setActiveChatIds] = useState<Record<Product, string | null>>({ engine: null, dev: null });
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageOwnerId, setStorageOwnerId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const runRef = useRef<{ product: Product; assistantId: string; controller: AbortController } | null>(null);
  const conversationViewport = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const message = drafts[selectedModel.id];
  const messages = conversations[selectedModel.id];
  const typedPrompt = useTypewriter(rotatingPrompts[selectedModel.id]);

  useEffect(() => {
    if (!supabase || !supabaseConnectionUrl || !supabasePublishableKey) {
      setSupabaseConnection("error");
      setAuthPending(false);
      return;
    }
    let live = true;
    fetch(`${supabaseConnectionUrl}/auth/v1/settings`, { headers: { apikey: supabasePublishableKey } })
      .then((response) => { if (!response.ok) throw new Error("Supabase rejected the connection."); if (live) setSupabaseConnection("connected"); })
      .catch(() => { if (live) setSupabaseConnection("error"); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (live) { setSession(currentSession); setAuthPending(false); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      if (live) { setSession(data.session); setAuthPending(false); }
    }).catch(() => { if (live) setAuthPending(false); });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("texdev-performance", performance); } catch { /* storage is optional */ }
  }, [performance]);

  useEffect(() => {
    const userId = session?.user.id;
    runRef.current?.controller.abort();
    runRef.current = null;
    setIsBusy(false);
    setDrafts({ engine: "", dev: "" });
    setAttachedFiles([]);
    setHistoryOpen(false);
    setAccountOpen(false);
    if (!userId) {
      setStorageReady(false);
      setStorageOwnerId(null);
      setSavedChats([]);
      setActiveChatIds({ engine: null, dev: null });
      setConversations({ engine: [], dev: [] });
      return;
    }
    let live = true;
    setStorageReady(false);
    setStorageError("");
    setSavedChats([]);
    setActiveChatIds({ engine: null, dev: null });
    setConversations({ engine: [], dev: [] });
    void loadUserChats(userId).then((chats) => {
      if (!live) return;
      setSavedChats(chats);
      setActiveChatIds({ engine: null, dev: null });
      setConversations({ engine: [], dev: [] });
      setStorageOwnerId(userId);
      setStorageReady(true);
    }).catch((error: unknown) => {
      if (!live) return;
      setStorageError(error instanceof Error ? error.message : "Could not load saved chats.");
      setStorageOwnerId(userId);
      setStorageReady(true);
    });
    return () => { live = false; };
  }, [session?.user.id]);

  useEffect(() => {
    const userId = session?.user.id;
    const product = selectedModel.id;
    const chatId = activeChatIds[product];
    const currentMessages = conversations[product];
    if (!storageReady || !userId || storageOwnerId !== userId || !chatId || !currentMessages.length || currentMessages.some((item) => item.status === "connecting" || item.status === "streaming")) return;
    const timer = window.setTimeout(() => {
      void saveUserChat(userId, chatId, product, currentMessages).then((chat) => {
        setSavedChats((previous) => [chat, ...previous.filter((item) => item.id !== chat.id)].sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
        setStorageError("");
      }).catch((error: unknown) => setStorageError(error instanceof Error ? error.message : "Could not save this chat."));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [activeChatIds, conversations, selectedModel.id, session?.user.id, storageOwnerId, storageReady]);

  const setMessage = (value: string) => setDrafts((current) => ({ ...current, [selectedModel.id]: value }));
  const updateProductMessages = (product: Product, update: (items: Message[]) => Message[]) => setConversations((current) => ({ ...current, [product]: update(current[product]) }));
  const updateMessage = (product: Product, id: string, update: (item: Message) => Message) => updateProductMessages(product, (items) => items.map((item) => item.id === id ? update(item) : item));

  const persistChatSnapshot = async (product: Product) => {
    const userId = session?.user.id;
    const chatId = activeChatIds[product];
    const currentMessages = conversations[product];
    if (!userId || !storageReady || storageOwnerId !== userId || !chatId || !currentMessages.length) return;
    try {
      const chat = await saveUserChat(userId, chatId, product, currentMessages);
      setSavedChats((previous) => [chat, ...previous.filter((item) => item.id !== chat.id)].sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
      setStorageError("");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Could not save this chat.");
    }
  };

  useEffect(() => {
    if (followLatest.current && conversationViewport.current) conversationViewport.current.scrollTop = conversationViewport.current.scrollHeight;
  }, [messages]);

  const stopGeneration = () => {
    const run = runRef.current;
    if (!run) return;
    run.controller.abort();
    updateMessage(run.product, run.assistantId, (item) => ({ ...item, status: "complete" }));
    runRef.current = null;
    setIsBusy(false);
  };

  const selectModel = (model: Model) => {
    if (model.id !== selectedModel.id && runRef.current) stopGeneration();
    followLatest.current = true;
    setSelectedModel(model);
  };

  const startNewChat = () => {
    const product = selectedModel.id;
    void persistChatSnapshot(product);
    if (runRef.current) stopGeneration();
    updateProductMessages(selectedModel.id, () => []);
    setActiveChatIds((current) => ({ ...current, [product]: crypto.randomUUID() }));
    setDrafts((current) => ({ ...current, [selectedModel.id]: "" }));
    if (window.innerWidth < 768) setHistoryOpen(false);
  };

  const openSavedChat = (chat: SavedChat) => {
    void persistChatSnapshot(selectedModel.id);
    if (runRef.current) stopGeneration();
    const model = models.find((item) => item.id === chat.product);
    if (model) setSelectedModel(model);
    setActiveChatIds((current) => ({ ...current, [chat.product]: chat.id }));
    setConversations((current) => ({ ...current, [chat.product]: chat.messages }));
    if (window.innerWidth < 768) setHistoryOpen(false);
    followLatest.current = true;
  };

  const submitMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const files = selectedModel.id === "dev" ? attachedFiles : [];
    const trimmed = message.trim() || (files.length ? "Please read the attached file(s), explain what they contain, and return an edited downloadable file if appropriate." : "");
    if ((!trimmed && files.length === 0) || isBusy) return;
    if (files.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024) {
      window.alert("Please keep the total upload size under 25 MB.");
      return;
    }
    const product = selectedModel.id;
    const previousMessages = conversations[product];
    if (!activeChatIds[product]) setActiveChatIds((current) => ({ ...current, [product]: current[product] ?? crypto.randomUUID() }));
    setDrafts((current) => ({ ...current, [product]: "" }));
    setAttachedFiles([]);
    setIsBusy(true);
    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    runRef.current = { product, assistantId, controller };
    followLatest.current = true;
    updateProductMessages(product, (current) => [...current,
      { id: crypto.randomUUID(), role: "user", content: message.trim(), attachments: files.map((file) => file.name), activities: [], status: "complete" },
      { id: assistantId, role: "assistant", content: "", activities: [], status: "connecting" },
    ]);
    try {
      const conversation = [...previousMessages, { id: "pending", role: "user" as const, content: trimmed, activities: [], status: "complete" as const }]
        .filter((item) => item.content && (item.role === "user" || item.status === "complete" || item.status === "streaming"))
        .map((item) => ({ role: item.role, content: item.content, artifacts: "artifacts" in item ? item.artifacts : undefined }));
      await streamAgentReply({ product, message: trimmed, performance, messages: conversation, files, web_search_enabled: searchEnabled, signal: controller.signal }, (event) => {
        if (event.type === "activity") updateMessage(product, assistantId, (item) => ({ ...item, status: "streaming", activities: mergeActivity(item.activities, event as ActivityEvent) }));
        if (event.type === "delta") updateMessage(product, assistantId, (item) => ({ ...item, status: "streaming", content: item.content + event.content }));
        if (event.type === "final") updateMessage(product, assistantId, (item) => ({ ...item, status: "complete", content: event.content }));
        if (event.type === "error") updateMessage(product, assistantId, (item) => ({ ...item, status: "error", content: event.message }));
        if (event.type === "artifact") updateMessage(product, assistantId, (item) => ({ ...item, artifacts: [...(item.artifacts ?? []), event.artifact] }));
        if (event.type === "done") updateMessage(product, assistantId, (item) => ({ ...item, status: item.status === "error" ? "error" : "complete" }));
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        updateMessage(product, assistantId, (item) => ({ ...item, status: "complete" }));
      } else {
        updateMessage(product, assistantId, (item) => ({ ...item, status: "error", content: error instanceof Error ? error.message : "Unable to reach the AI service." }));
      }
    } finally {
      if (runRef.current?.controller === controller) {
        runRef.current = null;
        setIsBusy(false);
      }
    }
  };


  if (authPending) return <main className="auth-screen"><div className="auth-loading">Connecting TexEngine…</div></main>;
  if (!session) return <AuthScreen client={supabase} connection={supabaseConnection} configured={supabaseConfigured} session={session} onSignedIn={setSession} />;

  return (
    <div className="flex h-dvh overflow-hidden bg-white font-sans text-zinc-900">
      <aside className={`${historyOpen ? "hidden" : "hidden md:flex"} w-[4.5rem] shrink-0 flex-col items-center border-r border-zinc-200 bg-zinc-50/80 py-4`}>
        <button
          type="button"
          aria-label="Start new chat"
          onClick={startNewChat}
          className="grid size-10 place-items-center rounded-xl bg-zinc-950 text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
        >
          <PlusIcon className="size-5" />
        </button>
        <div className="mt-6 flex flex-col gap-2">
          <IconButton label="Chats" onClick={() => setHistoryOpen((open) => !open)}>
            <ChatIcon className="size-5" />
          </IconButton>
          <IconButton label="Search">
            <SearchIcon className="size-5" />
          </IconButton>
        </div>
        <div className="mt-auto">
          <button
            type="button"
            aria-label="Account"
            title={session.user.email ?? "Account"}
            onClick={() => setAccountOpen((open) => !open)}
            className="grid size-9 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white ring-4 ring-zinc-100 transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-lime-200"
          >
            {session.user.email?.slice(0, 1).toUpperCase() ?? "TX"}
          </button>
        </div>
      </aside>

      {historyOpen && <ChatHistorySidebar chats={savedChats} activeId={activeChatIds[selectedModel.id]} onSelect={openSavedChat} onClose={() => setHistoryOpen(false)} onNew={startNewChat} />}

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(132,204,22,0.06),transparent_30%)]">
        <header className="flex h-[4.5rem] shrink-0 items-center justify-between px-4 sm:px-6">
          <ModelPicker selected={selectedModel} onSelect={selectModel} />
          <div className="flex items-center gap-1">
            <IconButton label="Chats" className="md:hidden" onClick={() => setHistoryOpen((open) => !open)}><ChatIcon className="size-5" /></IconButton>
            <IconButton label="Start new chat" className="md:hidden" onClick={startNewChat}>
              <PlusIcon className="size-5" />
            </IconButton>
            <IconButton label="Share chat">
              <ShareIcon className="size-[1.15rem]" />
            </IconButton>
            <IconButton label="More options">
              <DotsIcon className="size-5" />
            </IconButton>
            <IconButton label="Account" className="md:hidden" onClick={() => setAccountOpen((open) => !open)}><span className="grid size-7 place-items-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">{session.user.email?.slice(0, 1).toUpperCase() ?? "TX"}</span></IconButton>
            <div
              aria-label="Alpha Demo"
              className="ml-2 flex h-9 items-center rounded-full bg-lime-100 px-3 text-xs font-semibold text-lime-800 ring-1 ring-lime-200"
            >
              Alpha Demo
            </div>
          </div>
        </header>

        {accountOpen && <div className="absolute right-4 top-[4.2rem] z-40 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-zinc-900/10">
          <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime-100 text-sm font-bold text-lime-800">{session.user.email?.slice(0, 1).toUpperCase() ?? "T"}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Signed in</p><p className="truncate text-sm font-medium text-zinc-800">{session.user.email}</p></div></div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-3"><span className="text-sm text-zinc-600">Workspace</span><span className="rounded-full bg-lime-100 px-2.5 py-1 text-xs font-bold text-lime-800">Alpha Demo</span></div>
          <button type="button" onClick={() => { setAccountOpen(false); if (runRef.current) stopGeneration(); void persistChatSnapshot(selectedModel.id).finally(() => supabase?.auth.signOut()); }} className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">Log out</button>
        </div>}



        <section className="mx-auto flex min-h-0 w-full max-w-[min(96vw,96rem)] flex-1 flex-col px-4 pb-5 sm:px-6">
          <div ref={conversationViewport} onScroll={(event) => { const node = event.currentTarget; followLatest.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120; }} className={`flex min-h-0 flex-1 flex-col overflow-y-auto py-8 ${messages.length ? "justify-start" : "justify-center"}`}>
            {messages.length ? (
              <div className="mx-auto w-full max-w-[min(92vw,88rem)] py-4"><AgentPanel messages={messages} product={selectedModel.id} /></div>
            ) : (
              <div
                key={selectedModel.id}
                className="welcome-enter mx-auto w-full max-w-2xl text-center"
              >
                <div className="relative mx-auto mb-5 h-16 w-56 overflow-hidden">
                  <img
                    src={selectedModel.logo}
                    alt={selectedModel.name}
                    className="absolute inset-0 h-full w-full object-cover object-center mix-blend-multiply"
                  />
                </div>
                <h1 className="text-balance text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
                  WELCOME TO{" "}
                  <span
                    className={
                      selectedModel.id === "dev"
                        ? "text-blue-600"
                        : "text-lime-600"
                    }
                  >
                    {selectedModel.name}
                  </span>
                </h1>
                <p
                  aria-live="polite"
                  className="mx-auto mt-2 flex min-h-5 max-w-md items-center justify-center text-xs font-semibold tracking-[0.14em] text-zinc-400 sm:text-sm"
                >
                  <span>{typedPrompt}</span>
                  <span
                    aria-hidden="true"
                    className="type-cursor ml-1 inline-block h-3.5 w-px bg-lime-500"
                  />
                </p>
              </div>
            )}
          </div>

          {storageError && <p className="mx-auto mb-2 max-w-3xl rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">Chat saving needs attention: {storageError}. Apply the SQL migration in <code>supabase/migrations</code> in your Supabase SQL Editor if the chat table is missing.</p>}
          {selectedModel.id === "engine" && <p className="mx-auto mb-2 max-w-3xl text-center text-[11px] text-zinc-400">TexEngine answers questions and provides snippets in chat. Downloadable files and agent workflows are available in TexDEV.</p>}
          <ChatInput message={message} setMessage={setMessage} files={attachedFiles} onFilesChange={setAttachedFiles} allowFiles={selectedModel.id === "dev"} onSubmit={submitMessage} onStop={stopGeneration} isGenerating={isBusy} disabled={false} modelName={selectedModel.name}>
                <div className="flex min-w-0 items-center gap-1">
                  
                  <button
                    type="button"
                    aria-pressed={searchEnabled}
                    onClick={() => setSearchEnabled((enabled) => !enabled)}
                    className={`flex items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 sm:px-3 ${searchEnabled ? "bg-blue-50 text-blue-700" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"}`}
                  >
                    <GlobeIcon className="size-4 shrink-0" />
                    <span className="hidden sm:inline">Search</span>
                  </button>
                  <PerformancePicker
                    selected={performance}
                    onSelect={setPerformance}
                  />
                </div>
          </ChatInput>
        </section>
      </main>
    </div>
  );
}

function PlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparklesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3c.6 4.4 3.1 6.9 7.5 7.5C15.1 11.1 12.6 13.6 12 18c-.6-4.4-3.1-6.9-7.5-7.5C8.9 9.9 11.4 7.4 12 3Z" strokeLinejoin="round" />
      <path d="M19 16c.2 1.7 1.3 2.8 3 3-1.7.2-2.8 1.3-3 3-.2-1.7-1.3-2.8-3-3 1.7-.2 2.8-1.3 3-3Z" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 18.5 3.5 21v-5A8.5 8.5 0 1 1 7 18.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 15V3m0 0L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

function CompassIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" strokeLinejoin="round" />
    </svg>
  );
}

function CodeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M14 5l-4 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z" strokeLinecap="round" />
    </svg>
  );
}


function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className}>
      <path d="M12 19V5m0 0L6.5 10.5M12 5l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="m14.5 5.5 4 4M4 20l1.2-5.2L16.7 3.3a2.1 2.1 0 0 1 3 3L8.2 17.8 4 20Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UndoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M9 7H5v-4M5.5 7.5A8 8 0 1 1 4 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
