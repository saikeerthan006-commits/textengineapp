import { useRef, type FormEvent, type ReactNode } from "react";

type Props = {
  message: string;
  setMessage: (value: string) => void;
  onSubmit: (event?: FormEvent) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled: boolean;
  modelName: string;
  children: ReactNode;
  actions?: ReactNode;
  files: File[];
  onFilesChange: (files: File[]) => void;
  allowFiles: boolean;
};

export default function ChatInput({ message, setMessage, onSubmit, onStop, isGenerating, disabled, modelName, children, actions, files, onFilesChange, allowFiles }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl shrink-0">
      <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-2 shadow-[0_16px_50px_-20px_rgba(0,0,0,0.25)] transition focus-within:border-zinc-300 focus-within:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)]">
        {files.length > 0 && <div className="flex flex-wrap gap-2 px-3 pt-2">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-700"><span className="max-w-52 truncate">{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))} className="text-zinc-400 hover:text-zinc-800">×</button></span>)}</div>}
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); } }} rows={1} aria-label="Message Tex" placeholder={`Message ${modelName}`} className="max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-[15px] leading-6 text-zinc-900 outline-none placeholder:text-zinc-400" />
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <div className="flex min-w-0 items-center gap-1">{allowFiles && <><input ref={fileInput} type="file" multiple className="hidden" onChange={(event) => { onFilesChange([...files, ...Array.from(event.target.files ?? [])]); event.currentTarget.value = ""; }} /><button type="button" aria-label="Attach files" title="Attach files (up to 25 MB total)" onClick={() => fileInput.current?.click()} className="grid size-9 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"><PaperclipIcon /></button></>}{children}</div>
          <div className="flex shrink-0 items-center gap-2">{actions}{isGenerating ? <button type="button" aria-label="Stop generation" onClick={onStop} className="grid size-10 place-items-center rounded-full bg-lime-500 text-white transition hover:bg-lime-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2"><StopIcon /></button> : <button type="submit" aria-label="Send message" disabled={(!message.trim() && files.length === 0) || disabled} className="grid size-10 place-items-center rounded-full bg-lime-500 text-white transition hover:bg-lime-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"><ArrowUpIcon /></button>}</div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] leading-4 text-zinc-400">Tex can make mistakes. Check important information.</p>
    </form>
  );
}

function ArrowUpIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5"><path d="M12 19V5m0 0L6.5 10.5M12 5l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function PaperclipIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path d="m8.5 12.5 6.36-6.36a3 3 0 1 1 4.24 4.24l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function StopIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>; }
