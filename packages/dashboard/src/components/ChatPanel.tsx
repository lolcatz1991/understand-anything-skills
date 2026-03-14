import { useEffect, useRef, useState } from "react";
import { useDashboardStore } from "../store";

export default function ChatPanel() {
  const graph = useDashboardStore((s) => s.graph);
  const selectedNodeId = useDashboardStore((s) => s.selectedNodeId);
  const apiKey = useDashboardStore((s) => s.apiKey);
  const chatMessages = useDashboardStore((s) => s.chatMessages);
  const chatLoading = useDashboardStore((s) => s.chatLoading);
  const setApiKey = useDashboardStore((s) => s.setApiKey);
  const sendChatMessage = useDashboardStore((s) => s.sendChatMessage);
  const clearChat = useDashboardStore((s) => s.clearChat);

  const [input, setInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedNode = graph?.nodes.find((n) => n.id === selectedNodeId);

  // Load API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem("ua-api-key");
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, [setApiKey]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const handleSend = () => {
    if (!input.trim() || chatLoading || !apiKey) return;
    sendChatMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSetKey = () => {
    if (keyInput.trim()) {
      setApiKey(keyInput.trim());
      setKeyInput("");
    }
  };

  const handleKeyInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSetKey();
    }
  };

  return (
    <div className="h-full w-full bg-gray-800 rounded-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Chat
        </h3>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* API Key Input */}
      {!apiKey && (
        <div className="px-3 py-2 border-b border-gray-700 shrink-0">
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={handleKeyInputKeyDown}
              placeholder="Enter Anthropic API key..."
              className="flex-1 bg-gray-700 text-xs text-white rounded px-2 py-1.5 placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSetKey}
              disabled={!keyInput.trim()}
              className="text-xs bg-blue-600 text-white px-2 py-1.5 rounded hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Set
            </button>
          </div>
        </div>
      )}

      {/* Context Indicator */}
      {selectedNode && (
        <div className="px-3 py-1.5 border-b border-gray-700 shrink-0">
          <span className="text-[10px] text-gray-500">Context: </span>
          <span className="text-[10px] text-blue-400">{selectedNode.name}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {chatMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-xs text-center">
              {apiKey
                ? "Ask anything about this codebase"
                : "Set your API key to start chatting"}
            </p>
          </div>
        )}

        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-200"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg px-3 py-2 text-xs text-gray-400">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">Thinking</span>
                <span className="animate-pulse delay-100">.</span>
                <span className="animate-pulse delay-200">.</span>
                <span className="animate-pulse delay-300">.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-700 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              apiKey
                ? "Ask about this codebase..."
                : "Set API key first"
            }
            disabled={!apiKey || chatLoading}
            className="flex-1 bg-gray-700 text-xs text-white rounded px-2 py-1.5 placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!apiKey || chatLoading || !input.trim()}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
