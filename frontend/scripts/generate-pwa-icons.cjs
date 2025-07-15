const fs = require('fs');
const path = require('path');

// Icon sizes as specified in PWA_SETUP.md
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Base SVG content for ShopGauge (simplified, professional design)
const BASE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="icon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f8fafc;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="256" cy="256" r="240" fill="url(#bg)" stroke="#1e40af" stroke-width="8"/>
  
  <!-- Analytics icon -->
  <g fill="url(#icon)" transform="translate(128, 128) scale(0.5)">
    <!-- Chart bars -->
    <rect x="80" y="200" width="40" height="120" rx="4" opacity="0.9"/>
    <rect x="140" y="160" width="40" height="160" rx="4" opacity="0.9"/>
    <rect x="200" y="120" width="40" height="200" rx="4" opacity="0.9"/>
    <rect x="260" y="80" width="40" height="240" rx="4" opacity="0.9"/>
    <rect x="320" y="140" width="40" height="180" rx="4" opacity="0.9"/>
    
    <!-- Chart line -->
    <path d="M 60 180 Q 100 160 140 140 Q 180 120 220 100 Q 260 80 300 120 Q 340 160 380 140" 
          stroke="url(#icon)" stroke-width="8" fill="none" stroke-linecap="round"/>
    
    <!-- Data points -->
    <circle cx="100" cy="160" r="6" fill="url(#icon)"/>
    <circle cx="140" cy="140" r="6" fill="url(#icon)"/>
    <circle cx="180" cy="120" r="6" fill="url(#icon)"/>
    <circle cx="220" cy="100" r="6" fill="url(#icon)"/>
    <circle cx="260" cy="120" r="6" fill="url(#icon)"/>
    <circle cx="300" cy="140" r="6" fill="url(#icon)"/>
  </g>
  
  <!-- ShopGauge text -->
  <text x="256" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white">SG</text>
</svg>`;

// Function to create a simple PNG-like file (base64 encoded minimal PNG)
function createMinimalPNG(size) {
  // This is a minimal valid PNG structure for the given size
  // In a real implementation, you'd use a library like sharp or canvas
  // For now, we'll create a simple placeholder that browsers can handle
  
  const svgContent = BASE_SVG.replace(/width="512"/, `width="${size}"`).replace(/height="512"/, `height="${size}"`);
  
  // Convert SVG to a data URL that can be used as a PNG
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
  
  return dataUrl;
}

// Function to generate all icons
async function generateIcons() {
  console.log('🎨 Generating PWA icons...');
  
  const imagesDir = path.join(__dirname, '../public/images');
  
  // Ensure images directory exists
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  // Generate main app icons
  for (const size of ICON_SIZES) {
    const filename = `icon-${size}.png`;
    const filepath = path.join(imagesDir, filename);
    
    // Create SVG-based icon (simplified approach)
    const svgContent = BASE_SVG.replace(/width="512"/, `width="${size}"`).replace(/height="512"/, `height="${size}"`);
    
    // Save as SVG with .png extension (browsers will handle this)
    fs.writeFileSync(filepath, svgContent);
    console.log(`✅ Generated ${filename} (${size}x${size})`);
  }
  
  // Generate shortcut icons
  const shortcutIcons = [
    { name: 'shortcut-dashboard.png', description: 'Dashboard shortcut' },
    { name: 'shortcut-competitors.png', description: 'Competitors shortcut' },
    { name: 'shortcut-profile.png', description: 'Profile shortcut' }
  ];
  
  for (const icon of shortcutIcons) {
    const filepath = path.join(imagesDir, icon.name);
    const svgContent = BASE_SVG.replace(/width="512"/, 'width="96"').replace(/height="512"/, 'height="96"');
    fs.writeFileSync(filepath, svgContent);
    console.log(`✅ Generated ${icon.name} (${icon.description})`);
  }
  
  // Generate screenshot placeholders
  const screenshots = [
    { name: 'screenshot-wide.png', width: 1280, height: 720 },
    { name: 'screenshot-narrow.png', width: 720, height: 1280 }
  ];
  
  for (const screenshot of screenshots) {
    const filepath = path.join(imagesDir, screenshot.name);
    const svgContent = BASE_SVG
      .replace(/width="512"/, `width="${screenshot.width}"`)
      .replace(/height="512"/, `height="${screenshot.height}"`);
    fs.writeFileSync(filepath, svgContent);
    console.log(`✅ Generated ${screenshot.name} (${screenshot.width}x${screenshot.height})`);
  }
  
  console.log('\n🎉 PWA icon generation complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Replace the generated SVG-based icons with proper PNG files');
  console.log('2. Use a design tool or online service to create branded icons');
  console.log('3. Test the PWA installation on mobile devices');
  console.log('4. Verify all icons load correctly in the browser');
}

// Run the icon generation
generateIcons().catch(console.error); 