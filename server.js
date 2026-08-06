const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const os = require('os');
const cors = require('cors');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.static('public'));

// استخدام مجلد /tmp الخاص بـ Vercel لحفظ الملفات المؤقتة
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 } // حد أقصى 50 ميجابايت للمقطع لتجنب الـ Timeout
});

app.post('/api/enhance', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'الرجاء رفع فيديو أولاً!' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join(os.tmpdir(), `enhanced_${Date.now()}.mp4`);

  // فلاتر التعديل: رفع الأبعاد + زيادة الحدة (Sharpening) + تباين وألوان CC Edit
  const vfFilters = [
    'scale=1080:1920:flags=lanczos',
    'unsharp=5:5:1.5:5:5:0.0',
    'eq=contrast=1.2:saturation=1.3:brightness=0.03'
  ].join(',');

  ffmpeg(inputPath)
    .outputOptions([
      '-vf', vfFilters,
      '-c:v libx264',
      '-preset ultrafast', // أسرع معالجة لتجنب انتهاء وقت Vercel
      '-crf 18',           // جودة بصرية عالية جداً
      '-c:a copy'          // نسخ الصوت الأصلي بدون تأخير
    ])
    .save(outputPath)
    .on('end', () => {
      res.download(outputPath, '4K_CC_EDIT_ENHANCED.mp4', () => {
        // تنظيف الملفات المؤقتة بعد التحميل
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      });
    })
    .on('error', (err) => {
      console.error('FFmpeg Error:', err);
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      res.status(500).json({ error: 'حدث خطأ أثناء معالجة الفيديو. تأكد أن الفيديو قصير ومناسب.' });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;
