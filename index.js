import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- إعدادات المستخدم ---
const SEND_INTERVAL_SECONDS = 63; // عدد الثواني الفاصل بين كل دورة تمديد (غيّر هذا الرقم كما تشاء)
const RESPONSE_WINDOW_MS = 5000;   // 5 ثواني (النافذة الزمنية المسموح بها لحل الصور)
const CHANNEL_TASKS = 224;
const CHANNEL_ALLIANCE = 224;
// ------------------------

let lastCommandTime = 0; // لتخزين وقت إرسال آخر أمر

client.on('ready', async () => {
    console.log("🚀 البوت متصل! جاري بدء نظام التمديد التلقائي...");
    await client.group.joinById(CHANNEL_TASKS);
    await client.group.joinById(CHANNEL_ALLIANCE);
    
    // بدء حلقة التمديد
    startAutomation();
});

// دالة التكرار (الأوامر التلقائية)
async function startAutomation() {
    setInterval(async () => {
        try {
            console.log("⏳ جاري إرسال أوامر التمديد...");
            
            // 1. أمر المهام
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
            
            // 2. انتظار ثانيتين
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 3. أمر التحالف
            await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
            
            // 4. تحديث وقت آخر أمر (لفتح نافذة الـ 5 ثواني)
            lastCommandTime = Date.now();
            console.log("✅ تم إرسال الأوامر بنجاح.");
            
        } catch (err) {
            console.error("❌ خطأ في إرسال الأوامر:", err.message);
        }
    }, SEND_INTERVAL_SECONDS * 1000);
}

// مراقبة الرسائل
client.on('groupMessage', async (message) => {
    // التحقق هل الرسالة صورة
    const imageUrl = message.body || (message.attachments && message.attachments[0]?.link);
    if (!imageUrl || !(imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg') || imageUrl.endsWith('.png'))) return;

    // شرط النافذة الزمنية (5 ثواني بعد أمر البوت)
    const timeSinceLastCommand = Date.now() - lastCommandTime;
    if (timeSinceLastCommand > RESPONSE_WINDOW_MS) {
        // تجاهل الصورة إذا لم تكن في النافذة الزمنية
        return; 
    }

    console.log(`📸 تم استلام صورة ضمن النافذة الزمنية (${timeSinceLastCommand}ms). جاري الحل...`);

    try {
        const code = await solveCaptcha(imageUrl);
        await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
        console.log(`🎯 تم استخراج الرمز بنجاح: #${code}`);
    } catch (err) {
        console.error("❌ فشل الحل:", err.message);
    }
});

// دالة حل الكابتشا (بدون تغيير عن الإصدار الأخير)
async function solveCaptcha(url) {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * 4;
            if (data[idx] > 200 && data[idx + 1] > 200 && data[idx + 2] < 100) {
                minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                found = true;
            }
        }
    }
    if (!found) throw new Error("لم يتم العثور على الإطار");

    const processedBuffer = await sharp(buffer)
        .extract({ left: minX + 8, top: minY + 8, width: (maxX - minX) - 16, height: (maxY - minY) - 16 })
        .greyscale().normalize().linear(1.5, -0.2).sharpen().toBuffer();

    const worker = await createWorker('eng+ara');
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const { data: { text } } = await worker.recognize(processedBuffer);
    await worker.terminate();

    const result = text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
    if (!result) throw new Error("لا يوجد نص");
    return result;
}

client.login(process.env.U_MAIL, process.env.U_PASS);
