import type { ReactNode } from "react";
import { DropdownMenu } from "radix-ui";
import { Ellipsis } from "lucide-react";

export function ActionMenu({ label, trigger, heading, children, side = "bottom" }: {
  label: string;
  trigger?: ReactNode;
  heading?: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  return <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger className={trigger ? "nav-item profile-trigger" : "btn ghost icon"} aria-label={label}>
      {trigger ?? <Ellipsis />}
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="ui-menu" align="end" side={side} sideOffset={5} collisionPadding={12}>
        {heading && <><DropdownMenu.Label className="ui-menu-label">{heading}</DropdownMenu.Label><MenuSeparator /></>}
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}

export function MenuItem({ children, onSelect, disabled, destructive }: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return <DropdownMenu.Item className="ui-menu-item" disabled={disabled} data-destructive={destructive || undefined} onSelect={onSelect}>
    {children}
  </DropdownMenu.Item>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="ui-menu-divider" />;
}
