// Choose the buyer for a bill, or add a new one.
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, Search } from "lucide-react";
import api from "../../api/axios";
import Sheet from "../mobile/Sheet";
import BuyerCard from "../BuyerCard";
import ContactForm from "../forms/ContactForm";
import { Spinner, EmptyState } from "../ui";
import { useCan } from "../../context/AuthContext";

export default function BuyerPicker({ startNew, onSelect, onClose, onLimit }) {
  const can = useCan();
  const [query, setQuery] = useState("");
  const [buyers, setBuyers] = useState(null);
  const [editing, setEditing] = useState(startNew ? {} : null);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      api.get("/buyers", { params: query ? { search: query } : {} })
        .then(({ data }) => current && setBuyers(data.buyers))
        .catch(() => {
          if (!current) return;
          setBuyers([]);
          toast.error("Failed to load buyers");
        });
    }, query ? 250 : 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  const saved = (buyer) => onSelect(buyer);

  // Opened to add a buyer: show only the form
  if (startNew) {
    return <ContactForm kind="buyers" onClose={onClose} onSaved={saved} onLimit={onLimit} />;
  }

  return (
    <>
      <Sheet
        wide
        title="Select buyer"
        onClose={onClose}
        action={can("addBuyer") && (
          <button type="button" onClick={() => setEditing({})} className="btn-secondary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add New
          </button>
        )}
      >
        <div className="sticky top-0 z-10 bg-white p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search buyer by name..." aria-label="Search buyers" className="input h-11 pl-10 rounded-full" />
          </div>
        </div>
        {buyers === null ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : buyers.length === 0 ? (
          <EmptyState title="No buyers found." />
        ) : (
          <ul className="space-y-3 p-3">
            {buyers.map((b) => (
              <li key={b._id}>
                <BuyerCard party={b} onOpen={() => onSelect(b)} onEdit={can("editBuyer") ? () => setEditing(b) : undefined} />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      {editing && (
        <ContactForm kind="buyers" contact={editing} onClose={() => setEditing(null)} onSaved={saved} onLimit={onLimit} />
      )}
    </>
  );
}
