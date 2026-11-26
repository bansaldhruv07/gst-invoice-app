const express = require("express");
const router = express.Router();
const Buyer = require("../models/Buyer");
const Seller = require("../models/Seller");
const { protect } = require("../middleware/auth");
const ledger = require("../services/ledger");
const { route, findOwned, isDateString } = require("../services/common");

router.use(protect);

const period = ({ from, to }) => [isDateString(from) ? from : "", isDateString(to) ? to : ""];

router.get("/buyer/:id", route(async (req, res) => {
  const buyer = await findOwned(Buyer, req, req.params.id, "Buyer");
  res.json({
    success: true,
    party: buyer,
    ledger: await ledger.buyerLedger(req.user._id, buyer, ...period(req.query)),
  });
}));

router.get("/buyer/:id/context", route(async (req, res) => {
  const buyer = await findOwned(Buyer, req, req.params.id, "Buyer");
  res.json({ success: true, ...(await ledger.buyerContext(req.user._id, buyer)) });
}));

router.post("/buyer/:id/receive", route(async (req, res) => {
  const buyer = await findOwned(Buyer, req, req.params.id, "Buyer");
  const allocations = await ledger.receiveFromBuyer(req.user._id, buyer, req.body);
  res.json({ success: true, allocations });
}));

router.get("/seller/:id", route(async (req, res) => {
  const seller = await findOwned(Seller, req, req.params.id, "Seller");
  res.json({
    success: true,
    party: seller,
    ledger: await ledger.sellerLedger(req.user._id, seller, ...period(req.query)),
  });
}));

module.exports = router;
