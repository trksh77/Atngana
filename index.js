import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const { WOLF } = wolfjs;
const client = new WOLF();

const CHANNEL_ID = 81889058 ;
const AUTHORIZED_USER_ID = 51660277;

client.on('ready', async () => {
    console.log("🛠️ البوت في وضع التشخيص (Diagnostic Mode)...");
    await client.group.joinById(CHANNEL_ID);
});

client.on('groupMessage', async (message) => {
    // 1. طباعة تفاصيل الرسالة لنرى ما يراه البوت فعلياً
    console.log(`📩 رسالة جديدة - المرسل: ${message.sourceSubscriberId}, القناة: ${message.targetGroupId}`);

    // 2. التحقق من القناة والمرسل
    if (message.targetGroupId !== CHANNEL_ID) return;
    if (message.sourceSubscriberId !== AUTHORIZED_USER_ID) return;

    // 3. التحقق من وجود صورة (بصيغ مختلفة)
    const attachment = message.attachments && message.attachments[0];
    const imageUrl = message.body || (attachment && attachment.link);
    
    if (!imageUrl) {
        console.log("ℹ️ الرسالة لا تحتوي على صورة أو رابط.");
        return;
    }

    console.log(`📸 تم اكتشاف رابط/صورة: ${imageUrl}`);

    // 4. محاولة المعالجة
    try {
        console.log("⚙️ جاري محاولة المعالجة...");
        const code = await solveCaptcha(imageUrl);
        console.log(`✅ النتيجة النهائية: ${code}`);
        await client.messaging.sendGroupMessage(CHANNEL_ID, `#${code}`);
    } catch (err) {
        console.error("❌ فشلت المعالجة:", err.message);
    }
});

async function solveCaptcha(url) {
    console.log("🔍 تحميل الصورة من الرابط...");
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // فحص البيانات الأولية
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * 4;
            // اللون الأصفر: R و G عالٍ، B منخفض
            if (data[idx] > 200 && data[idx + 1] > 200 && data[idx + 2] < 100) {
                minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                found = true;
            }
        }
    }

    if (!found) {
        console.log("⚠️ لم أجد الإطار الأصفر في الصورة.");
        return null;
    }

    console.log("✅ وجدت الإطار الأصفر، جاري القص والقراءة...");
    
    const processedBuffer = await sharp(buffer)
        .extract({ left: minX + 5, top: minY + 5, width: (maxX - minX) - 10, height: (maxY - minY) - 10 })
        .greyscale().threshold(150).toBuffer();

    const worker = await createWorker('eng+ara');
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const { data: { text } } = await worker.recognize(processedBuffer);
    await worker.terminate();

    return text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
}

client.login(process.env.U_MAIL, process.env.U_PASS);
