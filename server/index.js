// Starts the server: checks settings, connects the database, listens.
require("dotenv").config();

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

if (!process.env.MONGO_URI) fail("MONGO_URI is not set");
if (!process.env.JWT_SECRET) fail("JWT_SECRET is not set");
// A non-number would be treated as a socket path, and no web port would open
const PORT = process.env.PORT || "5000";
if (!/^\d{1,5}$/.test(PORT)) fail("PORT must be a number. On Render, delete the PORT variable.");

if (process.env.JWT_SECRET.length < 32) {
  console.warn("⚠️  JWT_SECRET is short. Use at least 32 random characters.");
}
// One failed background task must not take the whole server down
process.on("unhandledRejection", (err) => console.error("Unhandled error:", err));

const mongoose = require("mongoose");
const app = require("./app");
const { seedPlans } = require("./services/seedPlans");

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected successfully");

    await seedPlans();

    app.listen(Number(PORT), () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
