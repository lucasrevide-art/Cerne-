import { Check, CheckCheck, LogOut, Moon, Settings, Sun, Timer, UserRound } from "lucide-react";
import { MenuItem, MenuSeparator } from "./ui/ActionMenu.tsx";
import { useUiStore } from "../stores/uiStore.ts";

/** Itens do menu da conta, iguais para dono e cliente. Foco e Conta e dados só aparecem para quem os recebe. */
export function AccountMenuItems({ onProfile, onCompleted, onFocusTools, onSettings, onSignOut, extra }: {
  onProfile: () => void; onCompleted: () => void; onFocusTools?: () => void; onSettings?: () => void; onSignOut?: () => void;
  extra?: React.ReactNode;
}) {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const pick = (target: "light" | "dark") => () => { if (theme !== target) toggleTheme(); };
  return <>
    <MenuItem onSelect={onProfile}><UserRound />Perfil e conta</MenuItem>
    <MenuItem onSelect={onCompleted}><CheckCheck />Concluídas</MenuItem>
    {onFocusTools && <MenuItem onSelect={onFocusTools}><Timer />Ferramentas de foco</MenuItem>}
    {onSettings && <MenuItem onSelect={onSettings}><Settings />Conta e dados</MenuItem>}
    {extra}
    <MenuSeparator />
    <MenuItem onSelect={pick("light")}><Sun />Claro{theme === "light" && <Check className="menu-check" />}</MenuItem>
    <MenuItem onSelect={pick("dark")}><Moon />Escuro{theme === "dark" && <Check className="menu-check" />}</MenuItem>
    {onSignOut && <><MenuSeparator /><MenuItem onSelect={onSignOut}><LogOut />Sair</MenuItem></>}
  </>;
}
