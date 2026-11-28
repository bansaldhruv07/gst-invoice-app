// A party as a card: name band with actions, then address, GSTIN and state.
import { Pencil, Trash2 } from "lucide-react";

export default function BuyerCard({ party, onOpen, onEdit, onDelete }) {
  const address = [party.address, party.city, party.pincode].filter(Boolean).join(", ");
  return (
    <article className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-sm">
      <div className="flex items-center gap-1 pl-4 pr-2 py-1.5 bg-brand-50 border-b border-brand-100">
        <button type="button" onClick={onOpen} className="flex-1 min-w-0 py-1.5 text-left text-sm font-bold text-slate-900 truncate">
          {party.name}
        </button>
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={`Edit ${party.name}`} className="p-2 rounded-lg text-slate-600 hover:bg-white">
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} aria-label={`Delete ${party.name}`} className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <dl onClick={onOpen} className="px-4 py-2.5 space-y-1.5 text-sm cursor-pointer">
        {[["Address", address || "—"], ["GSTIN", party.gstin || "Unregistered"], ["State", party.state || "—"]].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="flex-shrink-0 text-slate-500">{label}</dt>
            <dd className="min-w-0 text-right break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
