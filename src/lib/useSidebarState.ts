import { useEffect, useState } from "react";

/** Estado da barra lateral: recolhida (lembrada no navegador) e modo celular (menu em folha). */
export function useSidebarState() {
  const [compact, setCompact] = useState(() => matchMedia("(max-width: 680px)").matches);
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("cerne.sidebar") === "collapsed"; } catch { return false; } });
  useEffect(() => {
    const query = matchMedia("(max-width: 680px)");
    const update = () => { setCompact(query.matches); if (!query.matches) setMobileNav(false); };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem("cerne.sidebar", c ? "open" : "collapsed"); } catch { /* sem armazenamento: vale só nesta sessão */ }
    return !c;
  });
  return { compact, mobileNav, setMobileNav, collapsed: collapsed && !compact, toggle };
}
