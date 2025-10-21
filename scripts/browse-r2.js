require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

async function browseR2() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET,
    });
    
    const response = await client.send(command);
    console.log('📂 R2 Contents:');
    response.Contents?.forEach(item => {
      console.log(`${item.Key} (${item.Size} bytes)`);
    });
  } catch (error) {
    console.error('❌ Error browsing R2:', error);
  }
}

browseR2();