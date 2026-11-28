// The top bar of a screen on phones: back arrow (or the main menu), title and
// actions. It takes the place of the usual header; wider screens keep the usual one.
import { useState, useEffect, useContext } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Menu } from "lucide-react";
import { MenuContext } from "./menu";

export default function PageBar({ title, back, menu, children }) {
  const navigate = useNavigate();
  const openMenu = useContext(MenuContext);
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    setSlot(document.getElementById("page-bar"));
  }, []);

  if (!slot) return null;
  return createPortal(
    <>
      {menu ? (
        <button type="button" onClick={openMenu} aria-label="Open menu" className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100">
          <Menu className="w-5 h-5" />
        </button>
      ) : (
        <button type="button" onClick={() => navigate(back)} aria-label="Back" className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <span className="flex-1 min-w-0 truncate text-lg font-bold">{title}</span>
      {children}
    </>,
    slot,
  );
}
