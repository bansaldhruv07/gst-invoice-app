const express = require("express");
const router = express.Router();
const Item = require("../models/Item");
const { canAddItem } = require("../middleware/checkPlan");
const { protect } = require("../middleware/auth");

// All item routes require login
router.use(protect);

// ─── GET /api/items ───────────────────────────────────────────────────────────
// Returns all items belonging to the logged-in user
// Supports ?search=name and ?gstPercent=18 query params
router.get("/", async (req, res) => {
  try {
    const { search, gstPercent } = req.query;

    // Base filter: only this user's items
    const filter = { user: req.user._id };

    // Filter by name (case-insensitive partial match)
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // Filter by GST rate if provided
    if (gstPercent !== undefined) {
      filter.gstPercent = Number(gstPercent);
    }

    const items = await Item.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error("Get items error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET /api/items/:id ───────────────────────────────────────────────────────
// Returns a single item by ID
router.get("/:id", async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.json({ success: true, item });
  } catch (err) {
    console.error("Get item error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /api/items ──────────────────────────────────────────────────────────
// Creates a new item/product
router.post("/", canAddItem, async (req, res) => {
  try {
    const { name, hsn, unit, price, gstPercent, description } = req.body;

    // name and price are mandatory
    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Item name and price are required",
      });
    }

    const item = await Item.create({
      user: req.user._id,
      name,
      hsn: hsn || "",
      unit: unit || "pcs",
      price: Number(price),
      gstPercent: gstPercent !== undefined ? Number(gstPercent) : 18,
      description: description || "",
    });

    res.status(201).json({
      success: true,
      message: "Item created successfully",
      item,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }
    console.error("Create item error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PUT /api/items/:id ───────────────────────────────────────────────────────
// Updates an existing item
router.put("/:id", async (req, res) => {
  try {
    const { name, hsn, unit, price, gstPercent, description } = req.body;

    // Find item and ensure it belongs to logged-in user
    const item = await Item.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // Only update fields that were actually sent in the request
    if (name !== undefined) item.name = name;
    if (hsn !== undefined) item.hsn = hsn;
    if (unit !== undefined) item.unit = unit;
    if (price !== undefined) item.price = Number(price);
    if (gstPercent !== undefined) item.gstPercent = Number(gstPercent);
    if (description !== undefined) item.description = description;

    await item.save();

    res.json({
      success: true,
      message: "Item updated successfully",
      item,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }
    console.error("Update item error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DELETE /api/items/:id ────────────────────────────────────────────────────
// Deletes an item
router.delete("/:id", async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (err) {
    console.error("Delete item error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
