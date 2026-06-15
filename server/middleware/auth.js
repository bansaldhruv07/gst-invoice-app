const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ─── protect middleware ───────────────────────────────────────────────────────
// Add this to any route that requires login
// Usage: router.get("/some-route", protect, handlerFunction)
const protect = async (req, res, next) => {
  try {
    let token;

    // JWT is sent in the Authorization header as: "Bearer <token>"
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1]; // extract token part
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized — no token provided",
      });
    }

    // Verify the token using our secret key
    // If token is expired or tampered, jwt.verify throws an error
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the user from DB using the id stored inside the token
    // We exclude the password field for security
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized — user no longer exists",
      });
    }

    // Attach user to request object so route handlers can access it
    req.user = user;
    next(); // pass control to the actual route handler
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(401).json({
      success: false,
      message: "Not authorized — invalid or expired token",
    });
  }
};

module.exports = { protect };
