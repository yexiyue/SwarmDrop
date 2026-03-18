import Markdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-sm prose-headings:font-semibold",
        "prose-p:my-1 prose-p:leading-relaxed",
        "prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5",
        "prose-strong:font-semibold",
        "first:prose-headings:mt-0",
        className,
      )}
    >
      <Markdown>{content}</Markdown>
    </div>
  );
}
