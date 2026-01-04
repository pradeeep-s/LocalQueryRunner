# Encryption Key Setup Guide

The encryption key is used to securely encrypt database credentials (username and password) before storing them in Firestore.

## Quick Setup

### Method 1: Generate using Node.js (Recommended)

Open your terminal and run:

\`\`\`bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

This will output a 64-character hex string like:
\`\`\`
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
\`\`\`

### Method 2: Generate using the included script

1. Navigate to the `scripts` folder in your project
2. Run:
\`\`\`bash
node generate-encryption-key.js
\`\`\`

### Method 3: Generate online (use caution)

Visit: https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx
- Select: 256-bit
- Format: Hex
- Click Generate

**Important**: Only use trusted tools for production keys!

## Adding the Key to Your Project

### For Development (Local)

Create a `.env.local` file in your project root:

\`\`\`env
ENCRYPTION_KEY=your_64_character_hex_string_here
\`\`\`

### For Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Key**: `ENCRYPTION_KEY`
   - **Value**: Your 64-character hex string
   - **Environment**: Production, Preview, Development (check all)
4. Click **Save**
5. Redeploy your application

### For v0 Preview

1. Click the **Vars** icon in the left sidebar of this chat
2. Add a new variable:
   - **Key**: `ENCRYPTION_KEY`
   - **Value**: Your 64-character hex string
3. The dashboard will automatically use this key

## Verification

To verify your encryption key is working:

1. Go to `/admin/database-credentials`
2. Try adding a database configuration
3. If it saves without errors, your encryption key is working correctly

## Security Notes

1. **Never commit the encryption key to version control** (add `.env.local` to `.gitignore`)
2. **Use different keys for different environments** (dev, staging, production)
3. **Store keys securely** (use a password manager or secrets vault)
4. **Rotate keys periodically** in production
5. **If you change the key, existing encrypted data cannot be decrypted** - you'll need to re-enter all database credentials

## Key Requirements

- Must be exactly 64 hexadecimal characters (0-9, a-f)
- Must be kept secret and secure
- Should be randomly generated
- One key per environment

## Example Valid Keys

\`\`\`
a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
f1e2d3c4b5a6978f1e2d3c4b5a6978f1e2d3c4b5a6978f1e2d3c4b5a6978123
\`\`\`

## Troubleshooting

### Error: "ENCRYPTION_KEY is not set"
- Make sure you've added the environment variable
- Restart your development server after adding `.env.local`
- In Vercel, redeploy after adding environment variables

### Error: "Invalid key length"
- Ensure the key is exactly 64 characters
- Only use hexadecimal characters (0-9, a-f)
- No spaces or special characters

### Cannot decrypt existing data
- If you change the encryption key, you cannot decrypt data encrypted with the old key
- You'll need to re-enter all database credentials
- Consider keeping a backup of the old key if you need to migrate data
