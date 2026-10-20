const db = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function cleanBrokenImagePaths() {
  try {
    const assets = await db('assets').select('id', 'name', 'image_path');
    let cleaned = 0;

    for (const asset of assets) {
      if (!asset.image_path) continue;

      // If it's a Base64 string or HTTP URL, keep it!
      if (asset.image_path.startsWith('data:') || asset.image_path.startsWith('http://') || asset.image_path.startsWith('https://')) {
        continue;
      }

      // If it's a relative file path, check if file exists on disk
      const fullPath = path.join(__dirname, '..', asset.image_path);
      if (!fs.existsSync(fullPath)) {
        console.log(`[CleanImage] Asset ID ${asset.id} (${asset.name}) has non-existent file path: '${asset.image_path}'. Resetting to NULL.`);
        await db('assets').where('id', asset.id).update({ image_path: null });
        cleaned++;
      }
    }

    console.log(`[CleanImage] Cleaned ${cleaned} broken image paths in database.`);
    process.exit(0);
  } catch (err) {
    console.error(`[CleanImage] Error cleaning image paths:`, err);
    process.exit(1);
  }
}

cleanBrokenImagePaths();
