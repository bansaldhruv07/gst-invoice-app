// The top bar of a screen on phones: back arrow, title and actions. It takes the
// place of the usual header; wider screens keep the usual one.
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PageBar({ title, back, children }) {
  const navigate = useNavigate();
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    setSlot(document.getElementById("page-bar"));
  }, []);

  if (!slot) return null;
  return createPortal(
    <>
      <button type="button" onClick={() => navigate(back)} aria-label="Back" className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <span className="flex-1 min-w-0 truncate text-lg font-bold">{title}</span>
      {children}
    </>,
    slot,
  );
}
