import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 76023604;
const CHANNEL_TASKS = 224;
const CHANNEL_ALLIANCE = 224;
const TARGET_PLAYER_NAME = 'cat';

let lastCommandTime = 0;
let lastStatusRequestTime = 0;

client.on('ready', async () => {
    console.log(`🚀 البوت متصل!`);
    await client.group.joinById(CHANNEL_TASKS);
    await client.group.joinById(CHANNEL_ALLIANCE);
    startAutomation();
});

// --- الأتمتة ---
async function startAutomation() {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (true) {
        try {
            // 1. أوامر المهام الدورية
            lastCommandTime = Date.now();
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
            await sleep(2000);
            await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
            await sleep(2000);

            // 2. أمر "مد حالة" كل 30 دقيقة
            const thirtyMinutes = 30 * 60 * 1000;
            if (Date.now() - lastStatusRequestTime > thirtyMinutes) {
                console.log("🕒 طلب الحالة...");
                await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد حالة');
                lastStatusRequestTime = Date.now();
                await sleep(5000);
            }

            await sleep(50000);
        } catch (err) {
            console.error("❌ خطأ أتمتة:", err.message);
            await sleep(5000);
        }
    }
}

// --- وظائف تحليل الصور ---

// 1. التحقق من الاسم في أعلى الصورة
async function checkPlayerNameAtTop(buffer) {
    try {
        const metadata = await sharp(buffer).metadata();
        const croppedBuffer = await sharp(buffer)
            .extract({ left: 0, top: 0, width: Math.round(metadata.width * 0.4), height: Math.round(metadata.height * 0.15) })
            .greyscale()
            .threshold(160)
            .toBuffer();

        const worker = await createWorker('eng+ara');
        const { data: { text } } = await worker.recognize(croppedBuffer);
        await worker.terminate();

        const detectedName = text.trim();
        return detectedName.toLowerCase().includes(TARGET_PLAYER_NAME.toLowerCase());
    } catch (e) { return false; }
}

// 2. تحليل بيانات الحالة
async function analyzeStatus(buffer) {
    const worker = await createWorker('ara+eng');
    const processedBuffer = await sharp(buffer).greyscale().threshold(160).toBuffer();
    const { data: { text } } = await worker.recognize(processedBuffer);
    await worker.terminate();

    const timeMachine = text.match(/الجهاز الزمني[:\s]+([^\n\r]+)/u);
    const chests = text.match(/الصناديق[:\s]+(\d+)/u);
    const warranty = text.match(/نقاط الضمان[:\s]+(\d+)\/(\d+)/u);

    console.log("📊 --- تقرير الحالة المكتشف ---");
    console.log(`⏱️ الجهاز الزمني: ${timeMachine ? timeMachine[1].trim() : 'غير معروف'}`);
    console.log(`📦 الصناديق: ${chests ? chests[1] : '0'}`);
    
    if (warranty) {
        const current = parseInt(warranty[1]);
        const total = parseInt(warranty[2]);
        console.log(`🛡️ نقاط الضمان: ${current}/${total} | ${current >= total ? 'جاهز ✅' : 'غير جاهز ❌'}`);
    }
    console.log("------------------------------");
}

// 3. وظائف الكابتشا (الخاصة بك)
async function isCaptchaByColor(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let redPixels = 0;
    const totalPixels = info.width * info.height;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 120 && data[i] > (data[i + 1] + 30) && data[i] > (data[i + 2] + 30)) redPixels++;
    }
    return (redPixels / totalPixels) * 100 > 40;
}

async function solveCaptcha(buffer) {
    // ضع منطق الحل الخاص بك هنا (مختصر)
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    // ... (بقية منطقك القديم لحل الكابتشا)
    return "0000"; // مثال
}

// --- معالجة الرسائل ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId != TARGET_USER_ID) return;
    if (message.type !== 'image_link') return;

    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());

        // أ) التحقق من الكابتشا
        if (await isCaptchaByColor(buffer)) {
            if (Date.now() - lastCommandTime < 4000) {
                const code = await solveCaptcha(buffer);
                await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
            }
            return;
        }

        // ب) التحقق من صورة الحالة (إذا لم تكن كابتشا)
        if (await checkPlayerNameAtTop(buffer)) {
            console.log(`✅ تم التعرف على اللاعب ${TARGET_PLAYER_NAME} في الصورة.`);
            await analyzeStatus(buffer);
        } else {
            // تجاهل الصور الأخرى
        }

    } catch (err) {
        console.error("⚠️ خطأ:", err.message);
    }
});

client.login(process.env.U_MAIL, process.env.U_PASS);
