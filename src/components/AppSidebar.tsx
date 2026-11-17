import type { ReactNode } from "react";
import { ArrowLeft, ChevronsUpDown, PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { ActionMenu } from "./ui/ActionMenu.tsx";
import { initial } from "../lib/sidebar.ts";

export type SidebarItem = { key: string; label: string; icon: ReactNode; count?: number; active?: boolean; onSelect: () => void };
export type SidebarSpace = { key: string; label: string; color: string; count?: number; active?: boolean; onSelect: () => void };

/**
 * Barra lateral única do Cerne: a mesma para o dono e para o cliente.
 * O conteúdo (itens, espaços, menu da conta) vem de quem a usa.
 */
export function AppSidebar({ collapsed, compact, onToggle, onSearch, account, items, spacesTitle, spaces, back, create }: {
  collapsed: boolean;
  compact: boolean;
  onToggle: () => void;
  onSearch?: () => void;
  account: { name: string; email: string; menu: ReactNode };
  items: SidebarItem[];
  spacesTitle?: string;
  spaces: SidebarSpace[];
  back?: { label: string; onSelect: () => void };
  create?: { label: string; onSelect: () => void };
}) {
  const hint = (label: string) => collapsed ? label : undefined;
  return <aside className={`side${collapsed ? " collapsed" : ""}`} aria-label="Navegação principal">
    <div className="side-brand">
      <span className="side-logo" aria-hidden="true">C</span>
      <strong>Cerne</strong>
      {onSearch && <button className="side-icon" aria-label="Buscar" title="Buscar (⌘K)" onClick={onSearch}><Search /></button>}
      {!compact && <button className="side-icon" aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"} onClick={onToggle}>
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </button>}
    </div>

    <ActionMenu label={`Conta de ${account.name}`} side="bottom" align="start" triggerClass="side-account"
      heading={<><strong>{account.name}</strong><small>{account.email}</small></>}
      trigger={<>
        <span className="side-avatar" aria-hidden="true">{initial(account.name)}</span>
        <span className="side-account-text"><strong>{account.name}</strong><small>{account.email}</small></span>
        <ChevronsUpDown className="side-account-chevron" />
      </>}>
      {account.menu}
    </ActionMenu>

    <hr className="side-rule" />
    <nav className="side-list" aria-label="Seções">
      {items.map((item) => <button key={item.key} className="side-item" aria-current={item.active ? "page" : undefined}
        aria-label={item.label} title={hint(item.label)} data-active={item.active || undefined} onClick={item.onSelect}>
        {item.icon}<span className="side-label">{item.label}</span>
        {item.count !== undefined && item.count > 0 && <span className="side-count">{item.count}</span>}
      </button>)}
    </nav>

    {(spaces.length > 0 || back || create) && <>
      <hr className="side-rule" />
      <nav className="side-list side-spaces" aria-label={spacesTitle ?? "Espaços"}>
        {back && <button className="side-item side-back" aria-label={back.label} title={hint(back.label)} onClick={back.onSelect}>
          <ArrowLeft /><span className="side-label">{back.label}</span></button>}
        {spacesTitle && !collapsed && <p className="side-heading">{spacesTitle}</p>}
        {spaces.map((space) => <button key={space.key} className="side-item" aria-current={space.active ? "page" : undefined}
          aria-label={space.label} title={hint(space.label)} data-active={space.active || undefined} onClick={space.onSelect}>
          <span className="side-dot" style={{ background: space.color }} aria-hidden="true" />
          <span className="side-label">{space.label}</span>
          {space.count !== undefined && space.count > 0 && <span className="side-count">{space.count}</span>}
        </button>)}
        {create && <button className="side-item side-create" aria-label={create.label} title={hint(create.label)} onClick={create.onSelect}>
          <Plus /><span className="side-label">{create.label}</span></button>}
      </nav>
    </>}
  </aside>;
}
