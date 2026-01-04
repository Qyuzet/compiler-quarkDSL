"use client";

import { useMemo, useCallback } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "lucide-react";
import {
  parseDocReferences,
  scrollToDocSection,
  DocReference,
} from "@/lib/doc-navigation";

interface ChatMessageContentProps {
  content: string;
}

export default function ChatMessageContent({
  content,
}: ChatMessageContentProps) {
  const { processedContent, references } = useMemo(() => {
    const refs = parseDocReferences(content);
    let processed = content;

    // Replace doc references with placeholder markers
    refs.forEach((ref, index) => {
      processed = processed.replace(ref.fullMatch, `%%DOC_REF_${index}%%`);
    });

    return { processedContent: processed, references: refs };
  }, [content]);

  const handleRefClick = useCallback((ref: DocReference) => {
    console.log("[ChatMessage] Click on DocRef:", ref.searchText);
    const result = scrollToDocSection(ref.searchText);
    console.log("[ChatMessage] scrollToDocSection result:", result);
  }, []);

  // Handle clicking on text to search in docs
  const handleTextSearch = useCallback((text: string) => {
    console.log("[ChatMessage] Text search:", text);
    scrollToDocSection(text);
  }, []);

  // Custom link renderer - intercept all links and make them search docs
  const markdownComponents: Components = useMemo(
    () => ({
      a: ({ children, href }) => {
        // Extract the link text to use as search query
        const linkText =
          typeof children === "string"
            ? children
            : Array.isArray(children)
            ? children.map((c) => (typeof c === "string" ? c : "")).join("")
            : String(children || "");

        // If href is a real URL (http/https), render as normal link
        if (
          href &&
          (href.startsWith("http://") || href.startsWith("https://"))
        ) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {children}
            </a>
          );
        }

        // Otherwise, make it a doc search button
        return (
          <button
            onClick={() => handleTextSearch(linkText)}
            className="doc-ref-link"
            title={`Find in docs: ${linkText}`}
          >
            <ExternalLink className="w-3 h-3" />
            <span>{linkText}</span>
          </button>
        );
      },
    }),
    [handleTextSearch]
  );

  // Split content by placeholders and render with clickable links
  const renderContent = useMemo(() => {
    const parts = processedContent.split(/(%%DOC_REF_\d+%%)/);

    return parts.map((part, index) => {
      const refMatch = part.match(/%%DOC_REF_(\d+)%%/);

      if (refMatch) {
        const refIndex = parseInt(refMatch[1], 10);
        const ref = references[refIndex];

        if (ref) {
          return (
            <button
              key={`ref-${index}`}
              onClick={() => handleRefClick(ref)}
              className="doc-ref-link"
              title={`Find: ${ref.searchText}`}
            >
              <ExternalLink className="w-3 h-3" />
              <span>{ref.displayText}</span>
            </button>
          );
        }
      }

      // Regular markdown content with custom link handling
      if (part.trim()) {
        return (
          <ReactMarkdown
            key={`md-${index}`}
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {part}
          </ReactMarkdown>
        );
      }

      return null;
    });
  }, [processedContent, references, handleRefClick, markdownComponents]);

  return <div className="chat-message overflow-x-auto">{renderContent}</div>;
}
