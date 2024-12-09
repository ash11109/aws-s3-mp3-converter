const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const app = express();

require('dotenv').config();

const port = process.env.PORT || 3000;

const bucketName = 't2scrmash';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello AWS from ASH!' });
});

app.post('/api/upload/', upload.single('file'), async (req, res) => {
  const file = req.file;
  const key = Date.now() + '.' + file.mimetype.split('/')[1];

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    });

    const data = await s3Client.send(command);
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    res.json({ message: 'File uploaded successfully', fileUrl });
    
  } catch (err) {
    console.error('Error uploading file to S3', err);
    res.status(500).json({ error: 'Error uploading file to S3' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});