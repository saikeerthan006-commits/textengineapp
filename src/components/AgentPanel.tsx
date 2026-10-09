import ChatMessage from "./ChatMessage";
import type { Message } from "../types/agent";
import type { Product } from "../types/agent";

export default function AgentPanel({ messages, product }: { messages: Message[]; product: Product }) {
  return <div className="mx-auto w-full max-w-[min(92vw,88rem)] space-y-7">{messages.map((message) => <ChatMessage key={message.id} message={message} product={product} />)}</div>;
}
