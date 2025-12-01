#!/usr/bin/env node

/**
 * Bunny.net Upload Test Script
 *
 * Tests if your Bunny.net configuration is working correctly
 * Run: node scripts/test-bunny-upload.js
 */

require('dotenv').config({ path: '.env.local' });

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_STORAGE_URL = process.env.BUNNY_STORAGE_URL || 'https://storage.bunnycdn.com';

console.log('\n🧪 Bunny.net Configuration Test\n');
console.log('================================\n');

// Check configuration
console.log('1. Checking environment variables...');
console.log(`   BUNNY_STORAGE_ZONE: ${BUNNY_STORAGE_ZONE ? '✅ Set' : '❌ Missing'}`);
console.log(`   BUNNY_API_KEY: ${BUNNY_API_KEY ? '✅ Set (' + BUNNY_API_KEY.substring(0, 8) + '...)' : '❌ Missing'}`);
console.log(`   BUNNY_STORAGE_URL: ${BUNNY_STORAGE_URL}\n`);

if (!BUNNY_STORAGE_ZONE || !BUNNY_API_KEY) {
  console.error('❌ Missing required environment variables!');
  console.error('\nPlease set in .env.local:');
  console.error('   BUNNY_STORAGE_ZONE=your-storage-zone-name');
  console.error('   BUNNY_API_KEY=your-api-key-here\n');
  process.exit(1);
}

// Test upload
async function testUpload() {
  console.log('2. Testing upload to Bunny.net...\n');

  const testContent = 'Test upload from PetRecovery.org';
  const timestamp = Date.now();
  const filename = `test/upload-test-${timestamp}.txt`;
  const uploadUrl = `${BUNNY_STORAGE_URL}/${BUNNY_STORAGE_ZONE}/${filename}`;

  console.log(`   Upload URL: ${uploadUrl}`);
  console.log(`   Attempting upload...\n`);

  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_API_KEY,
        'Content-Type': 'text/plain',
      },
      body: testContent,
    });

    console.log(`   Response Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log('\n✅ SUCCESS! Bunny.net upload is working correctly.\n');

      // Try to delete the test file
      console.log('3. Cleaning up test file...');
      const deleteResponse = await fetch(uploadUrl, {
        method: 'DELETE',
        headers: {
          'AccessKey': BUNNY_API_KEY,
        },
      });

      if (deleteResponse.ok || deleteResponse.status === 404) {
        console.log('   ✅ Test file cleaned up\n');
      }

      return true;
    } else {
      const errorText = await response.text();
      console.log(`   Error Response: ${errorText}\n`);

      console.error('❌ UPLOAD FAILED!\n');
      console.error('Common causes:');
      console.error('   1. Wrong API key (AccessKey)');
      console.error('   2. Wrong storage zone name');
      console.error('   3. API key doesn\'t have write permissions\n');
      console.error('Please verify your Bunny.net credentials in the dashboard:\n');
      console.error('   https://dash.bunny.net/storage\n');

      return false;
    }
  } catch (error) {
    console.error('\n❌ Network error:', error.message, '\n');
    return false;
  }
}

testUpload().then(success => {
  process.exit(success ? 0 : 1);
});
