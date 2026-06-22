import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";

export default function UpgradePrompt({ message, feature, onClose }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">

        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-indigo-600" />
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Upgrade Required
        </h2>

        <p className="text-slate-500 text-sm mb-6">
          {message || "You've reached your plan limit. Upgrade to continue."}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
          >
            Maybe Later
          </button>
          <button
            onClick={() => { navigate("/pricing"); onClose?.(); }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            See Plans
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}