const os = require('os');
const path = require('path');
const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const app = express();

require('dotenv').config();

const port = process.env.PORT || 3000;
const bucketName = 't2scrmash';
const s3Folder = 'CRM_AUDIO';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello AWS from ASH!' });
});

app.post('/api/process-url', async (req, res) => {
  const { file } = req.body;

  if (!file) {
    return res.status(400).json({ error: 'No file URL provided' });
  }

  const tempInputFile = path.join(os.tmpdir(), `temp_input_${uuidv4()}`);
  const tempOutputFile = path.join(os.tmpdir(), `temp_output_${uuidv4()}.mp3`);

  const convertedKey = `${s3Folder}/${Date.now()}_${uuidv4()}.mp3`;

  try {
    const response = await axios({
      url: file,
      method: 'GET',
      responseType: 'stream',
    });

    const inputStream = fs.createWriteStream(tempInputFile);
    response.data.pipe(inputStream);

    await new Promise((resolve, reject) => {
      inputStream.on('finish', resolve);
      inputStream.on('error', reject);
    });

    await new Promise((resolve, reject) => {
      ffmpeg(tempInputFile)
        .toFormat('mp3')
        .on('error', reject)
        .on('end', resolve)
        .save(tempOutputFile);
    });

    const fileBuffer = fs.readFileSync(tempOutputFile);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: convertedKey,
      Body: fileBuffer,
      ContentType: 'audio/mpeg',
      ACL: 'public-read',
    });

    await s3Client.send(command);

    const convertedFileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${convertedKey}`;

    res.json({
      message: 'File processed and uploaded successfully',
      convertedFileUrl,
    });
  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).json({ error: 'An error occurred during file processing', details: err.message });
  } finally {
    if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile);
    if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});