// Logins for the people who work in a business, and the log of what they did.
// Only the owner can reach these routes (see services/permissions.js).
const express = require("express");
const User = require("../models/User");
const Activity = require("../models/Activity");
const { protect } = require("../middleware/auth");
const { getUserPlan } = require("../middleware/checkPlan");
const { route, BadRequest } = require("../services/common");
const { EMAIL, checkNewPassword, readMobile } = require("../services/identity");

const MAX_MEMBERS = 10;
const TEAM_ROLES = ["staff", "accountant"];

const publicMember = (m) => ({
  id: m._id, name: m.name, email: m.email, mobile: m.mobile || "", role: m.role, disabled: m.disabled,
  createdAt: m.createdAt,
});

async function checkMobileFree(mobile, ownId) {
  if (mobile && (await User.exists({ mobile, _id: { $ne: ownId } }))) {
    throw new BadRequest("That mobile number is already used by another account");
  }
}

async function findMember(req) {
  const member = await User.findOne({ _id: req.params.id, owner: req.user._id });
  if (!member) throw new BadRequest("Team login not found", 404);
  return member;
}

const team = express.Router();
team.use(protect);

team.get("/", route(async (req, res) => {
  const [members, { plan }] = await Promise.all([
    User.find({ owner: req.user._id }).sort({ createdAt: 1 }),
    getUserPlan(req.user._id),
  ]);
  res.json({
    success: true,
    allowed: Boolean(plan?.features?.multiUser),
    limit: MAX_MEMBERS,
    members: members.map(publicMember),
  });
}));

team.post("/", route(async (req, res) => {
  const { plan } = await getUserPlan(req.user._id);
  if (!plan?.features?.multiUser) {
    return res.status(403).json({
      success: false, upgrade: true,
      message: `Team logins are not part of the ${plan?.displayName || "current"} plan.`,
    });
  }
  const { name, email, password, role } = req.body;
  if (typeof name !== "string" || !name.trim()) throw new BadRequest("Enter their name");
  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    throw new BadRequest("Enter a valid email address");
  }
  if (!TEAM_ROLES.includes(role)) throw new BadRequest("Choose billing staff or accountant");
  const mobile = readMobile(req.body.mobile);
  checkNewPassword(password, { email, mobile });
  await checkMobileFree(mobile, null);
  if ((await User.countDocuments({ owner: req.user._id })) >= MAX_MEMBERS) {
    throw new BadRequest(`You can have up to ${MAX_MEMBERS} team logins`);
  }
  if (await User.exists({ email: email.trim().toLowerCase() })) {
    throw new BadRequest("That email already has an account");
  }
  const member = await User.create({
    name: name.trim(), email, password, role, owner: req.user._id, ...(mobile && { mobile }),
  });
  res.status(201).json({ success: true, member: publicMember(member) });
}));

team.put("/:id", route(async (req, res) => {
  const member = await findMember(req);
  const { name, role, disabled, password } = req.body;
  if (name !== undefined) member.name = String(name).trim();
  if (role !== undefined) {
    if (!TEAM_ROLES.includes(role)) throw new BadRequest("Choose billing staff or accountant");
    member.role = role;
  }
  if (disabled !== undefined) member.disabled = Boolean(disabled);
  if (req.body.mobile !== undefined) {
    const mobile = readMobile(req.body.mobile);
    await checkMobileFree(mobile, member._id);
    member.mobile = mobile || undefined;
  }
  if (password !== undefined) {
    checkNewPassword(password, { email: member.email, mobile: member.mobile });
    member.password = password;
    member.passwordChangedAt = new Date();
  }
  await member.save();
  res.json({ success: true, member: publicMember(member) });
}));

team.delete("/:id", route(async (req, res) => {
  const member = await findMember(req);
  await member.deleteOne();
  res.json({ success: true, member: publicMember(member) });
}));

const log = express.Router();
log.use(protect);

log.get("/", route(async (req, res) => {
  const size = 40;
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  const [entries, total] = await Promise.all([
    Activity.find({ user: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).lean(),
    Activity.countDocuments({ user: req.user._id }),
  ]);
  res.json({ success: true, entries, page, totalPages: Math.max(1, Math.ceil(total / size)) });
}));

module.exports = { team, activity: log };
