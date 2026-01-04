/**
 * Documentation navigation utilities
 * Handles scrolling and highlighting sections in the documentation
 *
 * Uses a simple, dynamic text-search approach that doesn't depend on
 * document structure. The AI just references the actual text to find.
 */

export interface DocReference {
  fullMatch: string;
  searchText: string; // The actual text to search for in the document
  displayText: string; // What to show in the link
}

/**
 * Parse doc references from AI message
 * Format: [DocRef: text to search for]
 *
 * The AI simply includes the text it wants to highlight.
 * No dependency on heading structure or section paths.
 */
export function parseDocReferences(text: string): DocReference[] {
  const references: DocReference[] = [];

  // Match [DocRef: ...] pattern
  const regex = /\[DocRef:\s*([^\]]+)\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const searchText = match[1].trim();
    if (!searchText || searchText.length < 3) continue;

    // Create a shorter display text if the search text is too long
    const displayText =
      searchText.length > 50 ? searchText.substring(0, 47) + "..." : searchText;

    references.push({
      fullMatch: match[0],
      searchText,
      displayText,
    });
  }

  return references;
}

/**
 * Scroll to and highlight text in the documentation
 * Pure text-search approach - no dependency on document structure
 */
export function scrollToDocSection(searchText: string): boolean {
  console.log("[DocNav] Searching for:", searchText);

  const docContainer = document.getElementById("documentation-scroll");
  if (!docContainer) {
    console.log("[DocNav] Documentation container not found");
    return false;
  }

  return findAndHighlightText(searchText);
}

/**
 * Normalize text for comparison - removes special chars and extra whitespace
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Replace special chars with space
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Find and highlight text anywhere in the document
 * Uses multiple strategies to find the best match
 */
function findAndHighlightText(searchText: string): boolean {
  console.log("[DocNav] Finding and highlighting:", searchText);

  const docContainer = document.getElementById("documentation-scroll");
  if (!docContainer) return false;

  const scrollViewport = docContainer.querySelector(
    "[data-radix-scroll-area-viewport]"
  ) as HTMLElement | null;

  const searchLower = searchText.toLowerCase().trim();
  const searchNormalized = normalizeText(searchText);

  // Search in headings first (highest priority)
  const headings = docContainer.querySelectorAll("h1, h2, h3, h4, h5, h6");
  for (const heading of headings) {
    const headingText = heading.textContent?.toLowerCase() || "";
    const headingNorm = normalizeText(heading.textContent || "");

    if (
      headingText.includes(searchLower) ||
      headingNorm.includes(searchNormalized) ||
      searchNormalized.includes(headingNorm)
    ) {
      console.log("[DocNav] Heading match:", heading.textContent);
      scrollAndHighlightElement(heading as HTMLElement, scrollViewport);
      return true;
    }
  }

  // Search in content elements
  const candidates = docContainer.querySelectorAll(
    "li, p, td, th, code, dt, dd, strong, b, em, span"
  );

  let bestMatch: HTMLElement | null = null;
  let bestScore = -Infinity;

  candidates.forEach((el) => {
    const text = el.textContent?.toLowerCase() || "";
    const textNorm = normalizeText(el.textContent || "");

    // Exact substring match (highest priority)
    if (text.includes(searchLower)) {
      const score = 10000 - text.length; // Prefer shorter matches
      if (score > bestScore) {
        bestMatch = el as HTMLElement;
        bestScore = score;
      }
      return;
    }

    // Normalized match
    if (textNorm.includes(searchNormalized)) {
      const score = 5000 - text.length;
      if (score > bestScore) {
        bestMatch = el as HTMLElement;
        bestScore = score;
      }
      return;
    }
  });

  // If no exact match, try word matching with lower threshold
  if (!bestMatch) {
    const words = searchNormalized.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0) {
      candidates.forEach((el) => {
        const textNorm = normalizeText(el.textContent || "");
        const matchCount = words.filter((w) => textNorm.includes(w)).length;
        const matchRatio = matchCount / words.length;

        // Require at least 40% word match
        if (matchRatio >= 0.4) {
          const score = matchCount * 100 - (el.textContent?.length || 0);
          if (score > bestScore) {
            bestMatch = el as HTMLElement;
            bestScore = score;
          }
        }
      });
    }
  }

  if (bestMatch) {
    console.log(
      "[DocNav] Content match:",
      bestMatch.textContent?.substring(0, 80)
    );
    scrollAndHighlightElement(bestMatch, scrollViewport);
    return true;
  }

  console.log("[DocNav] No match found for:", searchText);
  return false;
}

/**
 * Scroll to element and highlight it
 */
function scrollAndHighlightElement(
  element: HTMLElement,
  scrollViewport: HTMLElement | null
) {
  if (scrollViewport) {
    const viewportRect = scrollViewport.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const targetScroll =
      scrollViewport.scrollTop + (elementRect.top - viewportRect.top) - 120;

    scrollViewport.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: "smooth",
    });
  } else {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Highlight it
  element.classList.add("doc-text-highlight");
  setTimeout(() => {
    element.classList.remove("doc-text-highlight");
  }, 4000);
}

/**
 * Find sections containing specific text
 */
export function findSectionsContainingText(text: string): string[] {
  const headings = document.querySelectorAll("h1, h2, h3");
  const matchingIds: string[] = [];

  headings.forEach((heading) => {
    let current = heading.nextElementSibling;
    while (current && !["H1", "H2", "H3"].includes(current.tagName)) {
      if (current.textContent?.toLowerCase().includes(text.toLowerCase())) {
        matchingIds.push(heading.id);
        break;
      }
      current = current.nextElementSibling;
    }
  });

  return matchingIds;
}
