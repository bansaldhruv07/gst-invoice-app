// One worker's attendance on one day. Days without a record are not yet marked.
const mongoose = require("mongoose");

const STATUSES = ["present", "half", "absent", "leave"];

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: STATUSES, required: true },
    // When they came and left, as HH:MM on a 24-hour clock; "" when not noted
    inTime: { type: String, default: "" },
    outTime: { type: String, default: "" },
  },
  { timestamps: true },
);

attendanceSchema.index({ user: 1, worker: 1, date: 1 }, { unique: true });
attendanceSchema.index({ user: 1, date: 1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);
Attendance.STATUSES = STATUSES;

module.exports = Attendance;
