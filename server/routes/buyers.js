const express = require("express");
const router = express.Router();
const Buyer = require("../models/Buyer");
const Invoice = require("../models/Invoice");
const Quotation = require("../models/Quotation");
const Seller = require("../models/Seller");
const { protect } = require("../middleware/auth");
const { escapeRegex } = require("../services/invoiceNumber");
const { canAddBuyer } = require("../middleware/checkPlan");

const EXTRA_FIELDS = ["gstTreatment", "optionalField1", "optionalValue1"];
const pickExtra = (body) =>
  Object.fromEntries(EXTRA_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, String(body[k] ?? "")]));

// For a party the shop also buys from. Only the owner manages sellers.
async function addAsSeller(req, buyer) {
  if (req.role !== "owner") return;
  const name = new RegExp(`^${escapeRegex(buyer.name)}$`, "i");
  if (await Seller.exists({ user: req.user._id, name })) return;
  const { gstin, address, city, state, pincode, mobile, email } = buyer;
  await Seller.create({ user: req.user._id, name: buyer.name, gstin, address, city, state, pincode, mobile, email });
}

// All buyer routes require login — apply protect to every route in this file
router.use(protect);

// ─── GET /api/buyers ──────────────────────────────────────────────────────────
// Returns all buyers belonging to the logged-in user
// Supports ?search=name query param for filtering
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;

    // Base filter: only this user's buyers
    const filter = { user: req.user._id };

    // If search param provided, filter by name (case-insensitive)
    if (search) {
      filter.name = { $regex: escapeRegex(String(search)), $options: "i" };
    }

    const buyers = await Buyer.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: buyers.length,
      buyers,
    });
  } catch (err) {
    console.error("Get buyers error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET /api/buyers/:id ──────────────────────────────────────────────────────
// Returns a single buyer by ID
router.get("/:id", async (req, res) => {
  try {
    const buyer = await Buyer.findOne({
      _id: req.params.id,
      user: req.user._id, // ensure buyer belongs to this user
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: "Buyer not found",
      });
    }

    res.json({ success: true, buyer });
  } catch (err) {
    console.error("Get buyer error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /api/buyers ─────────────────────────────────────────────────────────
// Creates a new buyer
router.post("/", canAddBuyer, async (req, res) => {
  try {
    const { name, gstin, address, city, state, pincode, mobile, email } =
      req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Buyer name is required",
      });
    }

    const buyer = await Buyer.create({
      openingBalance: Number(req.body.openingBalance) || 0,
      creditLimit: Number(req.body.creditLimit) || 0,
      ...pickExtra(req.body),
      user: req.user._id, // tie buyer to logged-in user
      name,
      gstin: gstin || "",
      address: address || "",
      city: city || "",
      state: state || "",
      pincode: pincode || "",
      mobile: mobile || "",
      email: email || "",
    });

    if (req.body.alsoSeller) await addAsSeller(req, buyer);

    res.status(201).json({
      success: true,
      message: "Buyer created successfully",
      buyer,
    });
  } catch (err) {
    // Handle mongoose validation errors (e.g. invalid GSTIN format)
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }
    console.error("Create buyer error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PUT /api/buyers/:id ──────────────────────────────────────────────────────
// Updates an existing buyer
router.put("/:id", async (req, res) => {
  try {
    const { name, gstin, address, city, state, pincode, mobile, email } =
      req.body;

    // Find buyer and make sure it belongs to this user
    const buyer = await Buyer.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: "Buyer not found",
      });
    }

    // Update only the fields that were sent
    if (name !== undefined) buyer.name = name;
    if (gstin !== undefined) buyer.gstin = gstin;
    if (address !== undefined) buyer.address = address;
    if (city !== undefined) buyer.city = city;
    if (state !== undefined) buyer.state = state;
    if (pincode !== undefined) buyer.pincode = pincode;
    if (mobile !== undefined) buyer.mobile = mobile;
    if (email !== undefined) buyer.email = email;
    if (req.body.creditLimit !== undefined) buyer.creditLimit = Number(req.body.creditLimit) || 0;
    if (req.body.openingBalance !== undefined) {
      const opening = Number(req.body.openingBalance) || 0;
      const received = buyer.openingPayments.reduce((s, p) => s + p.amount, 0);
      if (opening < received) {
        return res.status(400).json({
          success: false,
          message: `₹${received} has already been received against the opening balance`,
        });
      }
      buyer.openingBalance = opening;
    }

    buyer.set(pickExtra(req.body));

    // pre-save hook will re-extract stateCode from new GSTIN automatically
    await buyer.save();
    if (req.body.alsoSeller) await addAsSeller(req, buyer);

    res.json({
      success: true,
      message: "Buyer updated successfully",
      buyer,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }
    console.error("Update buyer error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DELETE /api/buyers/:id ───────────────────────────────────────────────────
// Deletes a buyer (only if no invoices reference them — checked on frontend)
router.delete("/:id", async (req, res) => {
  try {
    const used =
      (await Invoice.exists({ user: req.user._id, buyer: req.params.id })) ||
      (await Quotation.exists({ user: req.user._id, buyer: req.params.id }));
    if (used) {
      return res.status(400).json({
        success: false,
        message: "This buyer has invoices or quotations, so cannot be deleted",
      });
    }
    const buyer = await Buyer.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: "Buyer not found",
      });
    }

    res.json({
      success: true,
      message: "Buyer deleted successfully",
    });
  } catch (err) {
    console.error("Delete buyer error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
