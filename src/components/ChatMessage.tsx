import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import ActivityStream from "./ActivityStream";
import type { Message } from "../types/agent";
import type { Product } from "../types/agent";
import ArtifactCard from "./ArtifactCard";

function wrapBareFractions(text: string) {
  const commandPattern = /\\(?:dfrac|tfrac|frac|binom|sqrt)\b/g;
  let output = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = commandPattern.exec(text)) !== null) {
    const start = match.index ?? 0;
    output += text.slice(cursor, start);
    let end = start + match[0].length;
    const readGroup = () => {
      while (/\s/.test(text[end] ?? "")) end += 1;
      if (text[end] !== "{") return false;
      let depth = 0;
      for (; end < text.length; end += 1) {
        if (text[end] === "\\") { end += 1; continue; }
        if (text[end] === "{") depth += 1;
        if (text[end] === "}" && --depth === 0) { end += 1; return true; }
      }
      return false;
    };
    const argumentCount = /\\(?:frac|dfrac|tfrac|binom)\b/.test(match[0]) ? 2 : 1;
    let valid = true;
    for (let argument = 0; argument < argumentCount; argument += 1) valid = readGroup() && valid;
    if (valid) {
      output += `$${text.slice(start, end)}$`;
      cursor = end;
      commandPattern.lastIndex = end;
    } else {
      output += match[0];
      cursor = start + match[0].length;
    }
  }
  return output + text.slice(cursor);
}

function repairPackedTable(line: string) {
  let normalized = line.replace(/\\\|/g, "|").trim();
  if (!normalized.includes("|")) return normalized;
  const delimiter = /\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?/.exec(normalized);
  if (!delimiter) return normalized;
  const count = (delimiter[0].match(/:?-{3,}:?/g) ?? []).length;
  const before = normalized.slice(0, delimiter.index).replace(/\|\s*$/, "");
  const after = normalized.slice(delimiter.index + delimiter[0].length);
  const rawHeader = before.split("|").map((cell) => cell.trim()).filter(Boolean);
  const header = rawHeader.slice(-count);
  if (header.length !== count) return normalized;
  const rawCells = after.split("|").map((cell) => cell.trim()).filter(Boolean);
  if (rawCells.length < count) return normalized;
  const prefix = before.split("|").slice(0, -count).join("|").trim();
  const table = [
    `| ${header.join(" | ")} |`,
    `| ${Array.from({ length: count }, () => "---").join(" | ")} |`,
    ...Array.from({ length: Math.ceil(rawCells.length / count) }, (_, index) => {
      const row = rawCells.slice(index * count, (index + 1) * count);
      return row.length === count ? `| ${row.join(" | ")} |` : "";
    }).filter(Boolean),
  ].join("\n");
  return `${prefix ? `${prefix}\n\n` : ""}${table}`;
}

function normalizeTableBlocks(content: string) {
  return content.replace(/```(?:text|plaintext|markdown|md)?[ \t]*\n([\s\S]*?)```/gi, (original, body: string) => {
    const lines = body.trim().split("\n").map((line) => line.trim());
    if (lines.length < 3 || !lines.every((line) => !line || line.includes("|") || /^[+\-: ]+$/.test(line))) return original;
    const rows = lines.filter((line) => line.includes("|") && !/^[|+\-: ]+$/.test(line)).map((line) => line.replace(/^\|?|\|?$/g, "").split("|").map((cell) => cell.trim()));
    if (rows.length < 2 || rows[0].length < 2 || !rows.every((row) => row.length === rows[0].length)) return original;
    return "\n\n" + [rows[0], rows[0].map(() => "---"), ...rows.slice(1)].map((row) => "| " + row.join(" | ") + " |").join("\n") + "\n\n";
  });
}

function formatMath(content: string) {
  content = normalizeTableBlocks(content);
  const codeParts = content.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return codeParts.map((part) => {
    if (part.startsWith("`")) return part;
    const displayPart = part.replace(/\[([^\]]+)\]\(sandbox:[^)]+\)/gi, "$1");
    // Older model responses sometimes arrive with prose broken into one
    // character per line. Rejoin those runs before Markdown lays them out.
    const normalized = displayPart
      .replace(/(?:^|\n)((?:[\p{L}\p{N}μσ]\s*\n){4,}[\p{L}\p{N}μσ])(?=\n|$)/gmu, (_match, letters: string) => {
        return `\n${letters.replace(/\s+/g, "").replace(/([a-z])([A-Z])/g, "$1 $2")}`;
      })
      .replace(/[\u{1D400}-\u{1D7FF}](?:\s+[\u{1D400}-\u{1D7FF}]){3,}/gu, (run) => {
        return run.normalize("NFKD").replace(/\s+/g, "").replace(/([a-z])([A-Z])/g, "$1 $2");
      });
    const delimited = normalized
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, math: string) => `$$\n${math.trim()}\n$$`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, math: string) => `$${math.trim()}$`)
      .replace(/\[\s*(\\(?:d?frac|tfrac|binom|sqrt|sum|int|prod|lim|begin)\b[^\]]*?)\s*\]/g, (_match, math: string) => `$[${math.trim()}]$`)
      .replace(/\\abs\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_match, math: string) => `\\left|${math}\\right|`);
    const repairedTables = delimited.split("\n").map(repairPackedTable).join("\n").split("\n").map((line) => {
      if (!/\|\s*[-:]{3,}/.test(line)) return line;
      const tableStart = line.indexOf("|");
      if (tableStart < 0) return line;
      const prefix = line.slice(0, tableStart).trimEnd();
      const table = line.slice(tableStart);
      return `${prefix ? `${prefix}\n\n` : ""}${table}`;
    }).join("\n");
    const repairedMarkdown = repairedTables
      .replace(/\s+---\s+(?=#{1,6}\s)/g, "\n\n---\n\n");
    return repairedMarkdown.split(/(\$\$[\s\S]*?\$\$|(?<!\\)\$[^\n$]*?\$)/g).map((segment) => {
      if (segment.startsWith("$")) return segment;
      return segment.split("\n").map((line) => {
        const trimmed = line.trim();
        const equationLine = /^(?:\\[A-Za-z]+|[A-Za-z][A-Za-z0-9]*(?:_\{?[A-Za-z0-9]+\}?|\^\{[^}]+\})?)\s*=\s*.+\\[A-Za-z]+/.test(trimmed);
        if (equationLine) return `\n\n$$\n${trimmed}\n$$\n\n`;
        return wrapBareFractions(line);
      }).join("\n");
    }).join("");
  }).join("");
}

function Diagram({ source }: { source: string }) {
  try {
    const data = JSON.parse(source) as { title?: string; nodes?: unknown[] };
    const nodes = (data.nodes ?? []).filter((node): node is string => typeof node === "string").slice(0, 6);
    if (!nodes.length) return <code>{source}</code>;
    return <svg className="chat-diagram" width={nodes.length * 190} height="156" role="img" aria-label={`${data.title ?? "Diagram"}: ${nodes.join(" → ")}`}>
      <text x="12" y="24" fontSize="16" fontWeight="600" fill="#1e3a5f">{data.title ?? "Diagram"}</text>
      {nodes.map((label, index) => <g key={index} transform={`translate(${index * 190 + 6}, 48)`}>
        <rect width="160" height="76" rx="16" fill="#eff6ff" stroke="#93c5fd" />
        <text x="80" y="31" textAnchor="middle" fontSize="12" fill="#1e3a5f">{label.slice(0, 23)}<tspan x="80" dy="20">{label.slice(23, 46)}</tspan></text>
        {index < nodes.length - 1 && <text x="169" y="43" fontSize="21" fill="#60a5fa">→</text>}
      </g>)}
    </svg>;
  } catch { return <code>{source}</code>; }
}

function ChatMessage({ message, product }: { message: Message; product: Product }) {
  if (message.role === "user") return <div className="flex justify-end"><div className="max-w-[72%] rounded-2xl rounded-br-md bg-lime-100 px-4 py-2.5 text-sm leading-6 text-zinc-800">{message.content && <p>{message.content}</p>}{message.attachments?.map((name) => <div key={name} className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium">{name}</div>)}</div></div>;
  const active = message.status === "connecting" || message.status === "streaming";
  return <article className={`assistant-message ${product === "dev" ? "texdev-message" : "texengine-message"}`}><ActivityStream activities={message.activities} active={active} />{message.status === "error" && <p className="agent-error">{message.content || "Unable to reach the AI service."}</p>}{message.content && message.status !== "error" && <div className="markdown-body"><Markdown components={{ code: ({ className, children }) => className === "language-diagram" ? <Diagram source={String(children)} /> : <code className={className}>{children}</code>, img: ({ src, alt }) => <img src={src} alt={alt ?? "Related image"} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; }} />, table: ({ children }) => <div className="markdown-table-scroll"><table>{children}</table></div> }} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { macros: { "\\abs": "\\left\\lvert #1 \\right\\rvert" } }]]}>{formatMath(message.content)}</Markdown></div>}{active && <div className="agent-start" aria-live="polite"><span className="brain-pulse" aria-hidden="true">🧠</span>{message.status === "connecting" ? "Agent is starting..." : "Agent is thinking..."}</div>}{message.artifacts?.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}</article>;
}

export default memo(ChatMessage);
