require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User");

const getOwnerSeedConfig = () => {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_DUMMY_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return {
    name: process.env.OWNER_NAME?.trim() || "Store Owner",
    email,
    password,
  };
};

const ensureOwnerAccount = async () => {
  const ownerConfig = getOwnerSeedConfig();

  if (!ownerConfig) {
    console.warn(
      "OWNER_EMAIL and OWNER_DUMMY_PASSWORD are not set. Skipping owner bootstrap."
    );
    return null;
  }

  const existingOwner = await User.findOne({ role: "owner" });
  if (existingOwner) {
    return existingOwner;
  }

  const existingUser = await User.findOne({ email: ownerConfig.email });
  if (existingUser) {
    existingUser.name = existingUser.name || ownerConfig.name;
    existingUser.role = "owner";
    existingUser.isFirstLogin = true;
    existingUser.password = ownerConfig.password;
    await existingUser.save();
    console.log(`Owner account promoted from existing user: ${existingUser.email}`);
    return existingUser;
  }

  const owner = await User.create({
    name: ownerConfig.name,
    email: ownerConfig.email,
    password: ownerConfig.password,
    role: "owner",
    isFirstLogin: true,
  });

  console.log(`Owner account created: ${owner.email}`);
  return owner;
};

const runSeedOwner = async () => {
  await connectDB();
  const owner = await ensureOwnerAccount();

  if (owner) {
    console.log("Owner bootstrap complete. First login requires password change.");
  }
  process.exit(0);
};

if (require.main === module) {
  runSeedOwner().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = ensureOwnerAccount;
