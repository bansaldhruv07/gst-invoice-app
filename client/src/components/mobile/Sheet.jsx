// A screen that opens over the current one. On phones "full" fills the screen
// with a back arrow and "bottom" slides up from the bottom; on wider screens
// both are centred dialogs.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";

// Escape closes only the sheet on top
const open = [];

export default function Sheet({ title, onClose, onSubmit, action, footer, children, variant = "full", wide }) {
  const id = useRef({});
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const me = id.current;
    open.push(me);
    const onKey = (e) => {
      if (e.key === "Escape" && open.at(-1) === me) {
        e.stopImmediatePropagation();
        close.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      open.splice(open.indexOf(me), 1);
    };
  }, []);

  const Frame = onSubmit ? "form" : "div";
  const full = variant === "full";

  // Events from a portal still travel to the parent component, so they stop here
  return createPortal(
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-[60] flex justify-center bg-slate-900/40 backdrop-blur-[2px] animate-fade sm:items-center sm:p-4 ${
        full ? "items-stretch" : "items-end"
      }`}
    >
      <Frame
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={
          onSubmit &&
          ((e) => {
            e.preventDefault();
            e.stopPropagation();
            onSubmit();
          })
        }
        className={`flex w-full flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl sm:max-h-[92vh] sm:animate-pop ${
          full ? "h-full sm:h-auto" : "max-h-[88vh] rounded-t-3xl animate-sheet"
        } ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <header className="flex-shrink-0 flex items-center gap-2 h-16 px-3 sm:px-5 border-b border-slate-200">
          {full && (
            <button type="button" onClick={onClose} aria-label="Back" className="sm:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="flex-1 min-w-0 truncate text-lg font-bold">{title}</h2>
          {action}
          <button type="button" onClick={onClose} aria-label="Close" className={`p-2 rounded-lg text-slate-500 hover:bg-slate-100 ${full ? "hidden sm:block" : ""}`}>
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex-shrink-0 flex gap-2 sm:justify-end border-t border-slate-200 p-3 sm:px-5 [&>*]:flex-1 sm:[&>*]:flex-none">{footer}</div>}
      </Frame>
    </div>,
    document.body,
  );
}
