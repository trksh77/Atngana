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
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
            await sleep(2000);
            await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
            
            // طلب الحالة كل 30 دقيقة
            if (Date.now() - lastStatusRequestTime > 30 * 60 * 1000) {
                await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد حالة');
                lastStatusRequestTime = Date.now();
                await sleep(5000);
            }
            await sleep(60000); 
        } catch (err) { console.error("❌ خطأ أتمتة:", err.message); await sleep(5000); }
    }
}

// --- معالجة الصور الذكية ---
async function processAndReadImage(buffer, isNameCheck = false) {
    // معالجة قوية جداً للصورة لجعل النص واضحاً (عتبة حادة)
    const processedBuffer = await sharp(buffer)
        .greyscale()
        .normalize() // تحسين التباين
        .threshold(128) // عتبة حادة جداً
        .toBuffer();

    const worker = await createWorker('ara+eng');
    const { data: { text } } = await worker.recognize(processedBuffer);
    await worker.terminate();
    
    return text;
}

// --- معالجة الرسائل ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId != TARGET_USER_ID || message.type !== 'image_link') return;

    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());

        // 1. هل هي كابتشا؟
        if (await isCaptchaByColor(buffer)) {
            const code = await solveCaptcha(buffer);
            if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
            return;
        }

        // 2. تحليل النص من الصورة
        const fullText = await processAndReadImage(buffer);
        console.log("📝 [النص المقروء]:\n", fullText); // للتشخيص

        // 3. التحقق من الاسم (الاسم يجب أن يكون موجوداً في النص)
        if (!fullText.toLowerCase().includes(TARGET_PLAYER_NAME.toLowerCase())) {
            console.log("⏭️ تجاهل: الاسم غير مطابق.");
            return;
        }

        // 4. استخراج البيانات (Regex مرن جداً)
        console.log("✅ تم العثور على اللاعب، جاري التحليل...");
        
        const timeMachine = fullText.match(/(?:الجهاز الزمني|الجهاز)[:\s]+([^\n\r]+)/u);
        const chests = fullText.match(/(?:الصناديق|صناديق)[:\s]+(\d+)/u);
        const warranty = fullText.match(/(?:نقاط الضمان|ضمان)[:\s]+(\d+)\/(\d+)/u);

        console.log(`⏱️ الجهاز الزمني: ${timeMachine ? timeMachine[1].trim() : 'غير موجود'}`);
        console.log(`📦 عدد الصناديق: ${chests ? chests[1] : '0'}`);
        
        if (warranty) {
            const current = parseInt(warranty[1]);
            const total = parseInt(warranty[2]);
            console.log(`🛡️ نقاط الضمان: ${current}/${total} (${current >= total ? 'جاهز ✅' : 'غير جاهز ❌'})`);
        }

    } catch (err) { console.error("⚠️ خطأ في المعالجة:", err.message); }
});

// --- دالة الكابتشا (كما في كودك الأصلي) ---
async function isCaptchaByColor(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let redPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 120 && data[i] > (data[i + 1] + 30) && data[i] > (data[i + 2] + 30)) redPixels++;
    }
    return (redPixels / (info.width * info.height)) * 100 > 40;
}

async function solveCaptcha(buffer) {
    // ضع منطق الحل الخاص بك هنا
    return "0000"; 
}

client.login(process.env.U_MAIL, process.env.U_PASS);
