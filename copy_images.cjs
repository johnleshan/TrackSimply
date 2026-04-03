const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\JOHN LESHAN\\.gemini\\antigravity\\brain\\59f6c0ed-2870-4ed6-a1f7-7e3672bddb62';
const assetsDir = path.join(__dirname, 'src', 'assets');

const filesToCopy = [
  { src: 'debt_tracker_mockup_1775118695467.png', dest: 'debt_tracker.png' },
  { src: 'bookkeeping_mockup_1775118864471.png', dest: 'bookkeeping.png' },
  { src: 'budget_planner_mockup_1775118889234.png', dest: 'budget_planner.png' },
  { src: 'inventory_tracker_mockup_1775118910549.png', dest: 'inventory_tracker.png' }
];

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

filesToCopy.forEach(file => {
  const srcPath = path.join(brainDir, file.src);
  const destPath = path.join(assetsDir, file.dest);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file.src} to ${file.dest}`);
  } else {
    console.error(`Source missing: ${srcPath}`);
  }
});
