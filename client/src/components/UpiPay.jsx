// A QR the buyer can scan to pay what is still due on an invoice.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { Download, Smartphone, QrCode } from "lucide-react";
import { upiLink } from "../lib/upi";
import { money } from "../lib/format";
import { useCan } from "../context/AuthContext";

export default function UpiPay({ invoice, business }) {
  const can = useCan();
  const [image, setImage] = useState({ link: "", url: "" });
  const due = invoice.balanceAmount;
  const upiId = business?.upiId;
  const link =
    upiId && due > 0
      ? upiLink({ upiId, name: business.name, amount: due, note: invoice.invoiceNumber })
      : "";

  useEffect(() => {
    if (!link) return;
    let current = true;
    QRCode.toDataURL(link, { width: 480, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => current && setImage({ link, url }))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [link]);

  if (due <= 0 || !business) return null;

  if (!upiId) {
    if (!can("settings")) return null;
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <QrCode className="w-4 h-4" />
        <Link to="/settings" className="font-semibold text-brand-700 hover:underline">Add your UPI ID</Link>
        to show a payment QR here.
      </p>
    );
  }

  return (
    <section className="card flex flex-wrap items-center gap-5 p-5">
      {image.link === link ? (
        <img src={image.url} alt={`UPI payment QR for ${money(due)}`} className="w-36 h-36 rounded-lg border border-slate-200 animate-fade" />
      ) : (
        <div className="skeleton w-36 h-36" />
      )}
      <div className="flex-1 min-w-[14rem]">
        <h3 className="card-title">Collect {money(due)} by UPI</h3>
        <p className="mt-1 text-sm text-slate-500">
          Paid to <span className="font-semibold text-slate-700">{upiId}</span>. Check your UPI app, then record the
          payment here. It is not marked paid by itself.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {image.link === link && (
            <a href={image.url} download={`UPI-${invoice.invoiceNumber.replace(/[^\w-]/g, "-")}.png`} className="btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" /> Save QR
            </a>
          )}
          <a href={link} className="btn-secondary btn-sm sm:hidden">
            <Smartphone className="w-3.5 h-3.5" /> Open UPI app
          </a>
        </div>
      </div>
    </section>
  );
}
