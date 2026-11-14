import { useRef, type ReactNode } from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { X } from "lucide-react";

export function Dialog({ title, children, onClose, className = "", closeButton = true, returnFocus }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  closeButton?: boolean;
  returnFocus?: HTMLElement | null;
}) {
  const previousFocus = useRef(returnFocus ?? document.activeElement as HTMLElement | null);
  return <RadixDialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="dialog-overlay" />
      <RadixDialog.Content className={`modal ${className}`} aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = previousFocus.current;
          if (target?.isConnected) requestAnimationFrame(() => target.isConnected && target.focus());
        }}>
        <RadixDialog.Title className={closeButton ? "dialog-title" : "sr-only"}>{title}</RadixDialog.Title>
        {closeButton && <RadixDialog.Close className="btn ghost icon dialog-close" aria-label="Fechar"><X /></RadixDialog.Close>}
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  </RadixDialog.Root>;
}
