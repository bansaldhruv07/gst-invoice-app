// A person who works for the business: how they are paid and what they have received.
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD, when the money was given
  forMonth: { type: String, required: true }, // YYYY-MM, the pay it counts against
  amount: { type: Number, required: true, min: 0 },
  kind: { type: String, enum: ["salary", "advance"], default: "salary" },
  note: { type: String, trim: true, default: "", maxlength: 200 },
});

const workerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: [true, "Enter the worker's name"], trim: true, maxlength: 80 },
    mobile: { type: String, trim: true, default: "", maxlength: 20 },
    work: { type: String, trim: true, default: "", maxlength: 60 },
    payType: { type: String, enum: ["daily", "monthly"], default: "daily" },
    // Rupees per day worked, or per month
    rate: { type: Number, default: 0, min: [0, "The pay cannot be negative"], max: 10000000 },
    // A normal day's work, the unpaid break in it, and pay for each extra hour
    shiftHours: { type: Number, default: 8, min: [1, "A shift is at least one hour"], max: [24, "A shift is at most 24 hours"] },
    breakMinutes: { type: Number, default: 0, min: [0, "The break cannot be negative"], max: [600, "The break is at most 10 hours"] },
    overtimeRate: { type: Number, default: 0, min: [0, "Overtime pay cannot be negative"], max: 100000 },
    joinedOn: { type: String, required: true }, // YYYY-MM-DD
    leftOn: { type: String, default: "" },
    payments: [paymentSchema],
  },
  { timestamps: true, optimisticConcurrency: true },
);

module.exports = mongoose.model("Worker", workerSchema);
