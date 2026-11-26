import { useEffect } from "react";
import { X } from "lucide-react";

// A dialog with a title, scrollable body and optional footer. With onSubmit the
// whole dialog is a form.
export default function Modal({ title, subtitle, onClose, onSubmit, footer, wide, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Frame = onSubmit ? "form" : "div";

  return (
    <div
      className="!m-0 fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-fade"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Frame
        onSubmit={
          onSubmit &&
          ((e) => {
            e.preventDefault();
            onSubmit();
          })
        }
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex flex-col w-full max-h-[90vh] bg-white rounded-2xl shadow-2xl animate-pop ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="card-head">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">{footer}</div>}
      </Frame>
    </div>
  );
}

export function Field({ label, wide, note, children }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      {children}
      {note && <span className="block mt-1 text-xs text-slate-500">{note}</span>}
    </label>
  );
}
