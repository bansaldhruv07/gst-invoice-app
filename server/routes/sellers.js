const express = require("express");
const router  = express.Router();
const Seller  = require("../models/Seller");
const { protect } = require("../middleware/auth");

router.use(protect);

// GET all sellers
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { user: req.user._id };
    if (search) filter.name = { $regex: search, $options: "i" };
    const sellers = await Seller.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: sellers.length, sellers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single seller
router.get("/:id", async (req, res) => {
  try {
    const seller = await Seller.findOne({ _id: req.params.id, user: req.user._id });
    if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });
    res.json({ success: true, seller });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create seller
router.post("/", async (req, res) => {
  try {
    const { name, gstin, address, city, state, pincode, mobile, email } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Seller name is required" });

    const seller = await Seller.create({
      user: req.user._id,
      name, gstin: gstin || "", address: address || "",
      city: city || "", state: state || "",
      pincode: pincode || "", mobile: mobile || "", email: email || "",
    });
    res.status(201).json({ success: true, message: "Seller created", seller });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update seller
router.put("/:id", async (req, res) => {
  try {
    const seller = await Seller.findOne({ _id: req.params.id, user: req.user._id });
    if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });

    const fields = ["name","gstin","address","city","state","pincode","mobile","email"];
    fields.forEach((f) => { if (req.body[f] !== undefined) seller[f] = req.body[f]; });
    await seller.save();
    res.json({ success: true, message: "Seller updated", seller });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE seller
router.delete("/:id", async (req, res) => {
  try {
    const seller = await Seller.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!seller) return res.status(404).json({ success: false, message: "Seller not found" });
    res.json({ success: true, message: "Seller deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;