/**
 * Markdown Message Component
 *
 * Renders AI messages with Markdown support including code syntax highlighting
 */

'use client'

import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'

interface MarkdownMessageProps {
  content: string
  className?: string
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  const components: Components = {
    // Code blocks with syntax highlighting
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : ''
      const codeString = String(children).replace(/\n$/, '')

      // Check if it's a code block (has language) or inline code
      if (language) {
        return (
          <div className="my-2 rounded-lg overflow-hidden">
            <SyntaxHighlighter
              style={oneDark as Record<string, React.CSSProperties>}
              language={language}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: '1rem',
                fontSize: '13px',
                borderRadius: '0.5rem',
              }}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        )
      }

      // Inline code
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[13px]"
          {...props}
        >
          {children}
        </code>
      )
    },
    // Paragraphs
    p({ children }) {
      return <p className="mb-2 last:mb-0">{children}</p>
    },
    // Links open in new tab with security attributes
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {children}
        </a>
      )
    },
    // Lists
    ul({ children }) {
      return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
    },
    li({ children }) {
      return <li className="leading-relaxed">{children}</li>
    },
    // Headings
    h1({ children }) {
      return <h1 className="text-lg font-bold mb-2">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-base font-bold mb-2">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-sm font-bold mb-2">{children}</h3>
    },
    // Blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-primary/30 pl-4 my-2 italic text-muted-foreground">
          {children}
        </blockquote>
      )
    },
    // Tables
    table({ children }) {
      return (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full border-collapse text-sm">
            {children}
          </table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-muted/50">{children}</thead>
    },
    th({ children }) {
      return (
        <th className="border border-border px-3 py-2 text-left font-semibold">
          {children}
        </th>
      )
    },
    td({ children }) {
      return (
        <td className="border border-border px-3 py-2">
          {children}
        </td>
      )
    },
    // Horizontal rule
    hr() {
      return <hr className="my-4 border-border" />
    },
    // Strong/Bold
    strong({ children }) {
      return <strong className="font-semibold">{children}</strong>
    },
    // Emphasis/Italic
    em({ children }) {
      return <em className="italic">{children}</em>
    },
  }

  return (
    <div className={cn("markdown-message text-[15px] leading-relaxed", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
