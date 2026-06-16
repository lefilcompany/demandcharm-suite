import { useState } from "react";
import { parseMentionsToArray } from "@/lib/mentionUtils";
import { MentionTag } from "./MentionTag";
import { DemandMentionTag } from "./DemandMentionTag";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface MentionTextProps {
  text: string;
  className?: string;
}

export function MentionText({ text, className }: MentionTextProps) {
  const parts = parseMentionsToArray(text);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Render a string part, converting \n to <br> elements
  const renderStringPart = (str: string, baseKey: number) => {
    const lines = str.split("\n");
    return lines.map((line, i) => (
      <span key={`${baseKey}-line-${i}`}>
        {line}
        {i < lines.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <>
      <div className={cn("whitespace-pre-wrap", className)}>
        {parts.map((part, index) => {
          if (typeof part === "string") {
            return <span key={index}>{renderStringPart(part, index)}</span>;
          }
          if (part.type === "user_mention") {
            return (
              <MentionTag
                key={`user-${part.userId}-${index}`}
                name={part.name}
                userId={part.userId}
                readOnly
              />
            );
          }
          if (part.type === "demand_mention") {
            return (
              <DemandMentionTag
                key={`demand-${part.demandId}-${index}`}
                demandId={part.demandId}
                code={part.code}
                readOnly
              />
            );
          }
          if (part.type === "link") {
            return (
              <a
                key={`link-${index}`}
                href={part.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(part.url, '_blank', 'noopener,noreferrer');
                }}
              >
                {part.displayText}
              </a>
            );
          }
          if (part.type === "inline_image") {
            return (
              <img
                key={`img-${index}`}
                src={part.src}
                alt="Imagem"
                className="max-w-full h-auto rounded-md my-2 block cursor-pointer hover:opacity-90 transition-opacity"
                style={part.width ? { width: `${part.width}px`, maxWidth: '100%' } : { maxWidth: '400px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxSrc(part.src);
                }}
              />
            );
          }
          return null;
        })}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={!!lightboxSrc} onOpenChange={(open) => !open && setLightboxSrc(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          {lightboxSrc && (
            <img
              src={lightboxSrc}
              alt="Imagem ampliada"
              className="max-w-full max-h-[85vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
