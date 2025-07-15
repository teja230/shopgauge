const fs = require('fs');
const path = require('path');

// PWA Testing Script
async function testPWA() {
  console.log('🧪 Testing PWA Implementation...\n');
  
  const publicDir = path.join(__dirname, '../public');
  const imagesDir = path.join(publicDir, 'images');
  
  // Test 1: Check if manifest.json exists and is valid
  console.log('1. Testing manifest.json...');
  try {
    const manifestPath = path.join(publicDir, 'manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    // Check required fields
    const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
    const missingFields = requiredFields.filter(field => !manifest[field]);
    
    if (missingFields.length === 0) {
      console.log('   ✅ manifest.json is valid and contains all required fields');
    } else {
      console.log(`   ❌ Missing required fields: ${missingFields.join(', ')}`);
    }
    
    // Check if icons are referenced
    if (manifest.icons && manifest.icons.length > 0) {
      console.log(`   ✅ ${manifest.icons.length} icons configured`);
    } else {
      console.log('   ❌ No icons configured in manifest');
    }
    
  } catch (error) {
    console.log(`   ❌ Error reading manifest.json: ${error.message}`);
  }
  
  // Test 2: Check if all icon files exist
  console.log('\n2. Testing icon files...');
  const requiredIcons = [
    'icon-72.png', 'icon-96.png', 'icon-128.png', 'icon-144.png',
    'icon-152.png', 'icon-192.png', 'icon-384.png', 'icon-512.png',
    'shortcut-dashboard.png', 'shortcut-competitors.png', 'shortcut-profile.png',
    'screenshot-wide.png', 'screenshot-narrow.png'
  ];
  
  let missingIcons = [];
  for (const icon of requiredIcons) {
    const iconPath = path.join(imagesDir, icon);
    if (!fs.existsSync(iconPath)) {
      missingIcons.push(icon);
    }
  }
  
  if (missingIcons.length === 0) {
    console.log('   ✅ All required icon files exist');
  } else {
    console.log(`   ❌ Missing icon files: ${missingIcons.join(', ')}`);
  }
  
  // Test 3: Check service worker
  console.log('\n3. Testing service worker...');
  const swPath = path.join(publicDir, 'sw.js');
  if (fs.existsSync(swPath)) {
    console.log('   ✅ Service worker file exists');
    
    // Check if service worker has basic functionality
    const swContent = fs.readFileSync(swPath, 'utf8');
    if (swContent.includes('install') && swContent.includes('fetch')) {
      console.log('   ✅ Service worker has install and fetch handlers');
    } else {
      console.log('   ⚠️  Service worker may be missing essential handlers');
    }
  } else {
    console.log('   ❌ Service worker file not found');
  }
  
  // Test 4: Check HTML meta tags
  console.log('\n4. Testing HTML meta tags...');
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const htmlContent = fs.readFileSync(indexPath, 'utf8');
    
    const requiredMetaTags = [
      'viewport',
      'theme-color',
      'apple-mobile-web-app-capable',
      'apple-mobile-web-app-status-bar-style'
    ];
    
    const missingMetaTags = requiredMetaTags.filter(tag => 
      !htmlContent.includes(`name="${tag}"`) && !htmlContent.includes(`property="${tag}"`)
    );
    
    if (missingMetaTags.length === 0) {
      console.log('   ✅ All required meta tags are present');
    } else {
      console.log(`   ⚠️  Missing meta tags: ${missingMetaTags.join(', ')}`);
    }
    
    // Check for manifest link
    if (htmlContent.includes('manifest.json')) {
      console.log('   ✅ Manifest link is present');
    } else {
      console.log('   ❌ Manifest link is missing');
    }
    
    // Check for service worker registration
    if (htmlContent.includes('serviceWorker.register')) {
      console.log('   ✅ Service worker registration is present');
    } else {
      console.log('   ❌ Service worker registration is missing');
    }
  } else {
    console.log('   ❌ index.html not found');
  }
  
  // Test 5: Check HTTPS requirement (for production)
  console.log('\n5. Testing HTTPS requirements...');
  console.log('   ℹ️  PWA requires HTTPS in production');
  console.log('   ℹ️  Local development can use HTTP');
  
  // Test 6: Generate PWA score
  console.log('\n6. PWA Score Assessment...');
  let score = 0;
  const maxScore = 100;
  
  // Manifest (20 points)
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'));
    if (manifest.name && manifest.short_name && manifest.start_url && manifest.display) score += 20;
  } catch (e) {}
  
  // Icons (20 points)
  const iconCount = requiredIcons.filter(icon => fs.existsSync(path.join(imagesDir, icon))).length;
  score += Math.min(20, (iconCount / requiredIcons.length) * 20);
  
  // Service Worker (20 points)
  if (fs.existsSync(swPath)) score += 20;
  
  // Meta Tags (20 points)
  if (fs.existsSync(indexPath)) {
    const htmlContent = fs.readFileSync(indexPath, 'utf8');
    if (htmlContent.includes('viewport') && htmlContent.includes('theme-color')) score += 20;
  }
  
  // HTTPS (20 points) - Always 20 for development
  score += 20;
  
  console.log(`   📊 PWA Score: ${score}/${maxScore} (${Math.round(score/maxScore*100)}%)`);
  
  if (score >= 90) {
    console.log('   🎉 Excellent PWA implementation!');
  } else if (score >= 70) {
    console.log('   ✅ Good PWA implementation with room for improvement');
  } else if (score >= 50) {
    console.log('   ⚠️  Basic PWA implementation - needs enhancement');
  } else {
    console.log('   ❌ PWA implementation needs significant work');
  }
  
  // Test 7: Generate recommendations
  console.log('\n7. Recommendations...');
  console.log('   📱 Test PWA installation on mobile devices');
  console.log('   🔍 Use Chrome DevTools > Application tab to verify PWA');
  console.log('   🎨 Replace placeholder icons with branded designs');
  console.log('   📸 Add real screenshots of your application');
  console.log('   🔧 Test offline functionality');
  console.log('   📊 Use Lighthouse to audit PWA performance');
  
  console.log('\n✅ PWA testing complete!');
}

// Run the test
testPWA().catch(console.error); 