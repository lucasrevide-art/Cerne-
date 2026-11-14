import type { ReactNode } from "react";
import { Tabs as RadixTabs } from "radix-ui";

export function Tabs<T extends string>({ value, onChange, label, items, className = "", children }: {
  value: T;
  onChange: (value: T) => void;
  label: string;
  items: ReadonlyArray<readonly [T, ReactNode]>;
  className?: string;
  children?: ReactNode;
}) {
  return <RadixTabs.Root className={className} value={value} onValueChange={(next) => {
    const item = items.find(([key]) => key === next);
    if (item) onChange(item[0]);
  }}>
    <RadixTabs.List className="seg" aria-label={label}>
      {items.map(([key, name]) => <RadixTabs.Trigger key={key} value={key}>{name}</RadixTabs.Trigger>)}
    </RadixTabs.List>
    {children}
  </RadixTabs.Root>;
}

export const TabPanel = RadixTabs.Content;
