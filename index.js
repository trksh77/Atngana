import wolfjs from 'wolf.js';
import axios from 'axios';
import Tesseract from 'tesseract.js';
import Jimp from 'jimp';

const { WOLF } = wolfjs;
const service = new WOLF();

// --- الإعدادات ---
const CONFIG = {
    MONITOR_GROUP: 81889058, // ضع معرف الروم الذي تراقب فيه هنا
    RESULT_ROOM: 9969        // ضع معرف الروم الذي تريد إرسال الحل فيه هنا
};

// --- وظيفة معالجة الكابتشا ---
async function solveCaptcha(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const image = await Jimp.read(response.data);

        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const blockWidth = Math.floor(width / 6);

        // اللون التقريبي للإطار المحيط (#490b0c)
        const TARGET_R = 73, TARGET_G = 11, TARGET_B = 12;
        let targetBlockIndex = 0;
        let maxColorMatches = 0;

        // البحث عن البطاقة التي تحمل اللون المطلوب
        for (let i = 0; i < 6; i++) {
            const currentBlock = image.clone().crop(i * blockWidth, 0, blockWidth, height);
            let matchCount = 0;

            currentBlock.scan(0, 0, currentBlock.bitmap.width, currentBlock.bitmap.height, (x, y, idx) => {
                const r = currentBlock.bitmap.data[idx];
                const g = currentBlock.bitmap.data[idx + 1];
                const b = currentBlock.bitmap.data[idx + 2];
                if (Math.abs(r - TARGET_R) < 40 && Math.abs(g - TARGET_G) < 40 && Math.abs(b - TARGET_B) < 40) {
                    matchCount++;
                }
            });

            if (matchCount > maxColorMatches) {
                maxColorMatches = matchCount;
                targetBlockIndex = i;
            }
        }

        // قص البطاقة والتحضير للقراءة
        const finalBlock = image.crop(targetBlockIndex * blockWidth, 0, blockWidth, height);
        await finalBlock.greyscale().contrast(1).normalize();
        const buffer = await finalBlock.getBufferAsync(Jimp.MIME_PNG);

        // القراءة
        const { data: { text } } = await Tesseract.recognize(buffer, 'ara+eng', {
            tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZابتثجحخدذرزسشصضطظعغفقكلمنهوي'
        });

        return text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
    } catch (err) {
        console.error("❌ خطأ:", err.message);
        return null;
    }
}

// --- المراقبة ---
service.on('groupMessage', async (message) => {
    // 1. الفلتر: يعمل فقط في الروم المحدد
    if (message.targetGroupId !== CONFIG.MONITOR_GROUP) return;

    let imageUrl = null;
    if (message.attachments && message.attachments.length > 0) imageUrl = message.attachments[0].link;
    else if (message.body && message.body.match(/\.(jpg|jpeg|png)$/)) imageUrl = message.body;

    if (imageUrl) {
        console.log("📸 تم اكتشاف صورة في الروم، جاري الحل...");
        const result = await solveCaptcha(imageUrl);
        
        if (result && result.length > 0) {
            console.log(`🔑 الحل النهائي: ${result}`);
            await service.messaging.sendGroupMessage(CONFIG.RESULT_ROOM, `# ${result}`);
        }
    }
});

service.login(process.env.U_MAIL, process.env.U_PASS);
