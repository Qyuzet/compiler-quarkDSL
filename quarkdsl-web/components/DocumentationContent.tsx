"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { rehypeCustomSlug } from "@/lib/rehype-custom-slug";
import { Copy, Check } from "lucide-react";

interface DocumentationContentProps {
  content: string;
}

function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-neutral-800 rounded-t-lg border-b border-neutral-700">
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          paddingTop: "3rem",
          borderRadius: "0.5rem",
          fontSize: "0.8125rem",
          lineHeight: "1.6",
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function DocumentationContentInner({ content }: DocumentationContentProps) {
  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Loading documentation...
      </div>
    );
  }

  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeCustomSlug]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");

            // Check if it's a code block (has newlines or is wrapped in pre)
            const isBlock = !inline && (codeString.includes("\n") || match);

            if (isBlock) {
              return (
                <CodeBlock language={match ? match[1] : ""}>
                  {codeString}
                </CodeBlock>
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }: any) {
            // Just return children since CodeBlock handles the wrapper
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

const DocumentationContent = memo(DocumentationContentInner);
export default DocumentationContent;
