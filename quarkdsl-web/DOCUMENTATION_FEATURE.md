# Documentation View Feature

## Overview

Added a comprehensive documentation view with AI-powered chatbot to the QuarkDSL web UI. Users can now toggle between the workspace (compiler interface) and documentation view.

## Features Implemented

### 1. View Toggle
- Added a toggle button in the header to switch between "Workspace" and "Documentation" views
- Clean UI with icons for each mode
- Preserves workspace state when switching views

### 2. Documentation View
- Displays the complete THEORY.md documentation
- Rendered using ReactMarkdown with GitHub Flavored Markdown support
- Scrollable area for easy navigation
- Professional typography with prose styling

### 3. AI Chatbot Assistant
- Powered by Google Gemini 1.5 Flash
- Context-aware: Has access to the complete THEORY.md documentation
- Can answer questions about:
  - Compiler theory (lexical analysis, parsing, optimization, code generation)
  - QuarkDSL language features and syntax
  - Quantum computing concepts
  - GPU programming
  - Internal compiler workings
- Conversation history maintained during session
- Clean chat UI with user/assistant message bubbles
- Markdown rendering in chat responses

## Technical Implementation

### Files Created/Modified

1. **quarkdsl-web/.env.local** (NEW)
   - Stores Gemini API key securely

2. **quarkdsl-web/app/api/chat/route.ts** (NEW)
   - API endpoint for chatbot
   - Integrates with Google Generative AI
   - Loads THEORY.md as context
   - Handles conversation history

3. **quarkdsl-web/components/DocumentationView.tsx** (NEW)
   - Main documentation view component
   - Split layout: documentation on left (2/3), chatbot on right (1/3)
   - Fetches and displays THEORY.md
   - Chat interface with message history

4. **quarkdsl-web/components/ui/scroll-area.tsx** (NEW)
   - Radix UI scroll area component
   - Used for scrollable documentation and chat

5. **quarkdsl-web/app/page.tsx** (MODIFIED)
   - Added view mode state
   - Added toggle buttons in header
   - Conditional rendering of workspace vs documentation view

6. **quarkdsl-web/public/THEORY.md** (COPIED)
   - Copy of main THEORY.md for web access

### Dependencies Added

```json
{
  "@google/generative-ai": "^0.x.x",
  "react-markdown": "^9.x.x",
  "remark-gfm": "^4.x.x",
  "@radix-ui/react-scroll-area": "^1.x.x"
}
```

## Usage

### For Users

1. **Access Documentation**
   - Click the "Documentation" button in the header
   - Browse the complete compiler theory documentation
   - Use the AI assistant to ask questions

2. **Ask Questions**
   - Type your question in the chat input
   - Press Enter or click Send
   - Get detailed, context-aware responses
   - Continue the conversation with follow-up questions

3. **Return to Workspace**
   - Click the "Workspace" button to return to the compiler interface
   - Your code and settings are preserved

### Example Questions for AI Assistant

- "How does the lexer convert regex to DFA?"
- "Explain the SSA form used in the IR"
- "What optimization passes are implemented?"
- "How do I write a quantum function in QuarkDSL?"
- "What's the difference between @gpu and @quantum annotations?"
- "Explain the recursive descent parser implementation"

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Header with Toggle                    │
│  [Workspace] [Documentation]                             │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
   Workspace View              Documentation View
   (3-panel grid)              (2-panel layout)
        │                                 │
        │                      ┌──────────┴──────────┐
        │                      │                     │
        │                 Theory Docs          AI Chatbot
        │                 (Markdown)           (Gemini)
        │                      │                     │
        │                      └─────────────────────┘
        │
   [Templates] [Editor] [Output]
```

## Security Notes

- API key stored in .env.local (not committed to git)
- Server-side API calls only (key never exposed to client)
- Rate limiting should be implemented for production use

## Future Enhancements

- Add code examples to chat responses
- Implement syntax highlighting in chat code blocks
- Add "Ask about this code" feature from workspace
- Save chat history to local storage
- Add documentation search functionality
- Implement streaming responses for better UX

