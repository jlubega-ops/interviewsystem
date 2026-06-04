// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable is not set.');
  console.error('   Please set DATABASE_URL in your .env file or environment variables.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    const email = 'eiicinterviews@mubs.ac.ug';
    const password = '123456789';
    const fullName = 'Super Administrator';
    const username = email.split('@')[0];

    console.log('🔐 Creating superadmin user...');
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Full Name: ${fullName}`);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Password hashed');

    // Check if user already exists using raw SQL to avoid schema issues
    // Don't select is_activated if column doesn't exist
    const existingUser = await prisma.$queryRaw`
      SELECT id, email, username, full_name, role, is_superadmin, is_active
      FROM users 
      WHERE email = ${email}
      LIMIT 1
    `;

    if (existingUser && existingUser.length > 0) {
      console.log('⚠️  User already exists. Updating to superadmin...');
      
      // Update existing user to superadmin using raw SQL
      // Try to update with is_activated, if column doesn't exist, update without it
      try {
        await prisma.$executeRaw`
          UPDATE users 
          SET 
            username = ${username},
            password_hash = ${hashedPassword},
            full_name = ${fullName},
            role = 'SUPERADMIN',
            is_superadmin = 1,
            cannot_be_deleted = 1,
            is_active = 1,
            is_activated = 1,
            updated_at = NOW()
          WHERE email = ${email}
        `;
      } catch (err) {
        // If is_activated column doesn't exist, update without it
        if (err.message.includes('is_activated')) {
          await prisma.$executeRaw`
            UPDATE users 
            SET 
              username = ${username},
              password_hash = ${hashedPassword},
              full_name = ${fullName},
              role = 'SUPERADMIN',
              is_superadmin = 1,
              cannot_be_deleted = 1,
              is_active = 1,
              updated_at = NOW()
            WHERE email = ${email}
          `;
        } else {
          throw err;
        }
      }

      // Fetch updated user
      const updatedUser = await prisma.$queryRaw`
        SELECT id, email, username, full_name as fullName, role, 
               is_superadmin as isSuperadmin, is_active as isActive
        FROM users 
        WHERE email = ${email}
        LIMIT 1
      `;

      const user = updatedUser[0];
      console.log('✅ Superadmin user updated successfully!');
      console.log('📋 User Details:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Full Name: ${user.fullName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Is Superadmin: ${user.isSuperadmin}`);
      console.log(`   Is Active: ${user.isActive}`);
    } else {
      console.log('➕ Creating new superadmin user...');
      
      // Generate UUID for new user
      const { randomUUID } = require('crypto');
      const userId = randomUUID();
      
      // Try to insert with is_activated, if column doesn't exist, insert without it
      try {
        await prisma.$executeRaw`
          INSERT INTO users (
            id, email, username, password_hash, full_name, role,
            is_superadmin, cannot_be_deleted, is_active, is_activated,
            created_at, updated_at
          ) VALUES (
            ${userId}, ${email}, ${username}, ${hashedPassword}, ${fullName}, 'SUPERADMIN',
            1, 1, 1, 1,
            NOW(), NOW()
          )
        `;
      } catch (err) {
        // If is_activated column doesn't exist, insert without it
        if (err.message.includes('is_activated')) {
          await prisma.$executeRaw`
            INSERT INTO users (
              id, email, username, password_hash, full_name, role,
              is_superadmin, cannot_be_deleted, is_active,
              created_at, updated_at
            ) VALUES (
              ${userId}, ${email}, ${username}, ${hashedPassword}, ${fullName}, 'SUPERADMIN',
              1, 1, 1,
              NOW(), NOW()
            )
          `;
        } else {
          throw err;
        }
      }

      // Fetch created user
      const newUser = await prisma.$queryRaw`
        SELECT id, email, username, full_name as fullName, role, 
               is_superadmin as isSuperadmin, is_active as isActive
        FROM users 
        WHERE email = ${email}
        LIMIT 1
      `;

      const user = newUser[0];
      console.log('✅ Superadmin user created successfully!');
      console.log('📋 User Details:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Full Name: ${user.fullName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Is Superadmin: ${user.isSuperadmin}`);
      console.log(`   Is Active: ${user.isActive}`);
    }

    console.log('\n🎉 Superadmin user is ready!');
    console.log(`\n📧 Login with:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Error creating superadmin user:', error);
    if (error.code === 'P2002') {
      console.error('   This email or username is already in use.');
    } else {
      console.error('   Details:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createSuperAdmin();

