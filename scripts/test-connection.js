require('dotenv').config();
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

async function testConnection() {
  try {
    const command = new HeadBucketCommand({
      Bucket: process.env.R2_BUCKET,
    });
    
    await client.send(command);
    console.log('✅ R2 Connection Successful');
    return true;
  } catch (error) {
    console.error('❌ R2 Connection Failed:', error);
    return false;
  }
}

testConnection();