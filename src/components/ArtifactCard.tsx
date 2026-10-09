import type { Artifact } from "../types/agent";

export default function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const presentation = artifact.artifact_type === "pptx";
  const word = artifact.artifact_type === "docx";
  const spreadsheet = artifact.artifact_type === "xlsx";
  const model = artifact.artifact_type === "model";
  const extension = artifact.filename.split(".").pop()?.toLowerCase();
  const code = artifact.artifact_type === "code" || artifact.language || ["py", "js", "jsx", "ts", "tsx", "java", "c", "cpp", "cs", "go", "rs", "php", "rb", "swift", "kt", "sql", "html", "css", "sh", "ps1", "r", "dart", "scala", "lua", "pl"].includes(extension ?? "");
  const label = presentation ? "PowerPoint presentation" : word ? "Word document" : spreadsheet ? "Excel workbook" : model ? "3D model" : code ? `${artifact.language ?? languageBadge(undefined, artifact.filename)} source file` : "Generated file";
  return <div className="artifact-card">
    <div className={`artifact-icon ${presentation ? "artifact-icon-ppt" : word ? "artifact-icon-word" : spreadsheet ? "artifact-icon-excel" : code ? "artifact-icon-code" : ""}`} aria-hidden="true">
      {presentation || word || spreadsheet ? <OfficeIcon letter={presentation ? "P" : word ? "W" : "X"} /> : code ? <span>{languageBadge(artifact.language, artifact.filename)}</span> : model ? <span className="text-[10px] font-extrabold">3D</span> : <DownloadIcon />}
    </div>
    <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-zinc-800">{artifact.filename}</div><div className="mt-0.5 text-xs text-zinc-500">{label}</div></div>
    <a className="artifact-download" href={artifact.download_url} download={artifact.filename}>Download</a>
  </div>;
}

function OfficeIcon({ letter }: { letter: "P" | "W" | "X" }) {
  const color = letter === "P" ? "#d35230" : letter === "W" ? "#185abd" : "#107c41";
  const light = letter === "P" ? "#ed6c47" : letter === "W" ? "#41a5ee" : "#21a366";
  return <svg viewBox="0 0 40 40" className="size-8" role="img" aria-label={letter === "P" ? "Microsoft PowerPoint" : letter === "W" ? "Microsoft Word" : "Microsoft Excel"}>
    <rect x="3" y="5" width="23" height="30" rx="4" fill={color} />
    <path d="M8 11h10v5H8zM8 18h10v5H8zM8 25h10v5H8z" fill={light} />
    <rect x="17" y="10" width="20" height="20" rx="3" fill={light} />
    <text x="27" y="24.2" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="Arial,sans-serif" fill="white">{letter}</text>
  </svg>;
}

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function languageBadge(language?: string, filename?: string) {
  const ext = filename?.split(".").pop()?.toLowerCase();
  const name = (language || ext || "code").toLowerCase();
  if (name.includes("python") || ext === "py") return "Py";
  if (name.includes("typescript") || ext === "ts" || ext === "tsx") return "TS";
  if (name.includes("javascript") || ext === "js" || ext === "jsx") return "JS";
  if (name.includes("rust") || ext === "rs") return "Rs";
  if (name.includes("java") || ext === "java") return "J";
  if (name.includes("c++") || ext === "cpp" || ext === "cc") return "C++";
  if (name.includes("c#") || ext === "cs") return "C#";
  if (name.includes("go") || ext === "go") return "Go";
  return (ext || "<> ").slice(0, 3).toUpperCase();
}
