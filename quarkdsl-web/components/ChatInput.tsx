"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

type LoadingPhase = "idle" | "reasoning" | "indexing" | "docs" | "generating";

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
  loadingPhase: LoadingPhase;
}

export default function ChatInput({
  onSend,
  loading,
  loadingPhase,
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = useCallback(() => {
    if (!input.trim() || loading) return;
    onSend(input);
    setInput("");
  }, [input, loading, onSend]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const getButtonContent = () => {
    if (!loading) {
      return (
        <div className="flex flex-col items-center gap-1">
          <Send className="w-5 h-5" />
          <span className="text-[9px] font-medium">Send</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-1.5">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-[9px] font-medium">
          {loadingPhase === "reasoning" && "Thinking"}
          {loadingPhase === "indexing" && "Indexing"}
          {loadingPhase === "docs" && "Loading"}
          {loadingPhase === "generating" && "Writing"}
        </span>
      </div>
    );
  };

  return (
    <div className="shrink-0 border-t pt-3">
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ask about QuarkDSL, compiler theory, or the documentation..."
          className="flex-1 min-h-17.5 max-h-30 text-xs resize-none border-2 focus:border-blue-500 dark:focus:border-blue-400 rounded-xl"
          disabled={loading}
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="h-17.5 px-5 shrink-0 transition-all bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {getButtonContent()}
        </Button>
      </div>
    </div>
  );
}
