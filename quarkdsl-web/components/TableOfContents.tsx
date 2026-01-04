"use client";

import { useEffect, useState } from "react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  onNavigate?: () => void;
  scrollContainerId?: string;
}

export default function TableOfContents({
  content,
  onNavigate,
  scrollContainerId,
}: TableOfContentsProps) {
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const headings = content.match(/^#{1,3}\s+.+$/gm) || [];
    const idCounts = new Map<string, number>();

    const tocItems = headings.map((heading, index) => {
      const level = heading.match(/^#+/)?.[0].length || 1;
      const text = heading.replace(/^#+\s+/, "");
      let id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const count = idCounts.get(id) || 0;
      if (count > 0) {
        id = `${id}-${count}`;
      }
      idCounts.set(id.replace(/-\d+$/, ""), count + 1);

      return { id, text, level };
    });
    setToc(tocItems);
  }, [content]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px" }
    );

    const headings = document.querySelectorAll("h1, h2, h3");
    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [toc]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    if (scrollContainerId) {
      const container = document.getElementById(scrollContainerId);
      const viewport = container?.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement | null;

      if (viewport) {
        // Calculate offset relative to the viewport
        const viewportRect = viewport.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const currentScrollTop = viewport.scrollTop;
        const targetScrollTop =
          currentScrollTop + elementRect.top - viewportRect.top - 20;

        viewport.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      }
    } else {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    onNavigate?.();
  };

  if (toc.length === 0) return null;

  return (
    <nav className="sticky top-4 space-y-1">
      <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-2 px-2">
        Table of Contents
      </h4>
      <div className="space-y-0.5 text-xs">
        {toc.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollToHeading(item.id)}
            className={`block w-full text-left px-2 py-1 rounded transition-colors ${
              item.level === 1 ? "font-semibold" : ""
            } ${item.level === 2 ? "pl-4" : ""} ${
              item.level === 3 ? "pl-6" : ""
            } ${
              activeId === item.id
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            {item.text}
          </button>
        ))}
      </div>
    </nav>
  );
}
