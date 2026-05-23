import 'dotenv/config';
import wolfjs from 'wolf.js';
import cv from 'opencv4nodejs';
import Tesseract from 'tesseract.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL || 'your_email@example.com',
    secret: process.env.U_PASS || 'your_password',
    taskGroupId: 81889058,
    depositGroupId: 81889058
};

const MY_INFO = { myId: "80055399" };
const service = new WOLF();

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// دالة فخ الصور (الفخ السادس)
async function solveImageTrap(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const image = cv.imdecode(Buffer.from(response.data));
        
        // معالجة الصورة لاكتشاف الإطارات
        const gray = image.cvtColor(cv.COLOR_BGR2GRAY);
        const blurred = gray.gaussianBlur(new cv.Size(5, 5), 0);
        const edged = blurred.canny(75, 200);
        const contours = edged.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        for (let contour of contours) {
            const rect = contour.boundingRect();
            const area = rect.width * rect.height;
            // تصفية للحصول على المستطيلات (البطاقات)
            if (area > 5000) { 
                const roi = image.getRegion(rect);
                const tempPath = path.join(process.cwd(), 'temp_card.jpg');
                cv.imwrite(tempPath, roi);

                // قراءة النص (عربي + إنجليزي)
                const { data: { text } } = await Tesseract.recognize(tempPath, 'ara+eng');
                fs.unlinkSync(tempPath);

                if (text.trim().length > 0) return text.trim();
            }
        }
    } catch (err) { console.error("Error processing image:", err); }
    return null;
}

service.on('groupMessage', async (message) => {
    try {
        const content = message.body;
        const isTargetGroup = message.targetGroupId === settings.taskGroupId || message.targetGroupId === settings.depositGroupId;
        if (!isTargetGroup) return;

        // --- الفخاخ النصية (1-5) ---
        if (content.includes("تحقق") && content.includes(MY_INFO.myId)) {
            // [منطق الفخاخ النصية الذي وضعناه سابقاً]
            // (تم الاختصار هنا لتركيز المساحة على الفخ 6)
        }

        // --- الفخ السادس: تحليل الصور ---
        if (message.hasAttachments) {
            const attachment = message.attachments[0];
            const result = await solveImageTrap(attachment.link);
            if (result) {
                console.log(`✅ فخ الصور: الإجابة هي: ${result}`);
                await service.messaging.sendGroupMessage(message.targetGroupId, `#${result}`);
            }
        }

    } catch (err) { console.error("خطأ:", err); }
});

service.on('ready', async () => {
    console.log(`🚀 البوت نشط بجميع الأنظمة (6/6).`);
    await service.group.joinById(settings.taskGroupId);
    await service.group.joinById(settings.depositGroupId);
});

service.login(settings.identity, settings.secret);
