const express = require("express");
const router = express.Router();
const Item = require("../models/Item");
const StockAdjustment = require("../models/StockAdjustment");
const { protect } = require("../middleware/auth");
const { computeStock, stockHistory } = require("../services/stock");
const { BadRequest, route, findOwned } = require("../services/common");

router.use(protect);

router.get("/", route(async (req, res) => {
  res.json({ success: true, stock: await computeStock(req.user._id) });
}));

router.get("/:itemId/history", route(async (req, res) => {
  const item = await findOwned(Item, req, req.params.itemId, "Product");
  const adjustments = await StockAdjustment.find({ user: req.user._id, item: item._id }).sort({ date: -1 });
  res.json({
    success: true,
    history: await stockHistory(req.user._id, item.toObject()),
    adjustments,
  });
}));

router.post("/adjust", route(async (req, res) => {
  const item = await findOwned(Item, req, req.body.itemId, "Product");
  if (!item.trackStock) throw new BadRequest("Switch on stock tracking for this product first");
  const quantity = Number(req.body.quantity);
  if (!quantity) throw new BadRequest("Enter how much to add or remove");
  const adjustment = await StockAdjustment.create({
    user: req.user._id,
    item: item._id,
    quantity,
    reason: String(req.body.reason || ""),
    date: req.body.date || new Date(),
  });
  res.status(201).json({ success: true, adjustment });
}));

router.delete("/adjust/:id", route(async (req, res) => {
  const adjustment = await findOwned(StockAdjustment, req, req.params.id, "Adjustment");
  await adjustment.deleteOne();
  res.json({ success: true });
}));

module.exports = router;
