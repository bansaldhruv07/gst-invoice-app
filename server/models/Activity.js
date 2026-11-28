const mongoose = require("mongoose");

// Who changed what in a business account
const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, required: true },
    role: { type: String, required: true },
    action: { type: String, required: true },
    label: { type: String, default: "", maxlength: 200 },
    // The record that was changed, for its history
    target: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ user: 1, target: 1 });

module.exports = mongoose.model("Activity", activitySchema);
