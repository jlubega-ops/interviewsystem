// Load environment variables
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");

if (!process.env.DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL environment variable is not set.");
  console.error("   Set DATABASE_URL in your .env file.");
  process.exit(1);
}

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME || "System Admin";
const firstName = process.env.ADMIN_FIRST_NAME || "System";
const lastName = process.env.ADMIN_LAST_NAME || "Admin";
const organisation = process.env.ADMIN_ORGANISATION || "MUBS";

if (!email || !password) {
  console.error("❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set.");
  console.error("   Example: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=your-secure-password npm run create-admin");
  process.exit(1);
}

if (password.length < 8) {
  console.error("❌ Error: ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

async function createAdmin() {
  try {
    const username = email.split("@")[0];

    console.log("🔐 Creating admin user...");
    console.log(`   Email: ${email}`);
    console.log(`   Full Name: ${fullName}`);
    console.log(`   Role: ADMIN`);

    const hashedPassword = await bcrypt.hash(password, 12);
    console.log("✅ Password hashed");

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log("⚠️  User already exists. Updating to admin...");
      await prisma.user.update({
        where: { email },
        data: {
          username,
          passwordHash: hashedPassword,
          fullName,
          firstName: firstName || existingUser.firstName,
          lastName: lastName || existingUser.lastName,
          organisation: organisation || existingUser.organisation,
          role: "ADMIN",
          isSuperadmin: false,
          cannotBeDeleted: false,
          isActive: true,
          isActivated: true,
          isSuspended: false,
          suspensionReason: null,
        },
      });
      console.log("✅ Admin user updated successfully!");
    } else {
      await prisma.user.create({
        data: {
          id: randomUUID(),
          email,
          username,
          passwordHash: hashedPassword,
          fullName,
          firstName,
          lastName,
          organisation,
          role: "ADMIN",
          isSuperadmin: false,
          cannotBeDeleted: false,
          isActive: true,
          isActivated: true,
          isSuspended: false,
        },
      });
      console.log("✅ Admin user created successfully!");
    }

    console.log("\n🎉 Admin user is ready!");
    console.log("\n📧 Login with:");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(
      "\n   Optional .env overrides: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_ORGANISATION\n",
    );
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    if (error.code === "P2002") {
      console.error("   This email or username is already in use.");
    } else {
      console.error("   Details:", error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
