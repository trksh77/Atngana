import 'dotenv/config';
import wolfjs from 'wolf.js';
import axios from 'axios';

const { WOLF } = wolfjs;
const service = new WOLF();

const settings = {
    allowedGroupIds: [81889058], 
    verificationGroupId: 9969,
    apiKey: process.env.API_KEY || 'K83171079488957'
};

// دالة الحل عبر API مع إضافة "مراقب وقت" (Timeout)
async function solveCaptcha(imageUrl) {
    console.log("🔍 محاولة الاتصال بـ API...");
    try {
        const response = await axios.post('https://api.ocr.space/parse/image', null, {
            params: { 
                apikey: settings.apiKey, 
                url: imageUrl, 
                language: 'eng', 
                OCREngine: 2 
            },
            timeout: 15000 // البوت سينتظر 15 ثانية فقط قبل أن يقطع الاتصال
        });

        // طباعة حالة الاستجابة للتأكد
        console.log("✅ تم استلام رد من الـ API.");
        
        if (response.data.ParsedResults?.length > 0) {
            const text = response.data.ParsedResults[0].ParsedText.trim();
            console.log("📄 النص المستخرج:", text);
            return text;
        } else {
            console.log("⚠️ API لم يرجع أي نص. الرد:", JSON.stringify(response.data));
            return null;
        }
    } catch (err) {
        // هنا سنعرف لماذا لا يعمل الاتصال
        if (err.response) {
            console.error("❌ خطأ من الخادم (API):", err.response.status, err.response.data);
        } else if (err.code === 'ECONNABORTED') {
            console.error("❌ خطأ: انتهى الوقت (Timeout) قبل الحصول على رد من الـ API.");
        } else {
            console.error("❌ خطأ عام في الاتصال:", err.message);
        }
        return null;
    }
}

service.on('groupMessage', async (message) => {
    if (!settings.allowedGroupIds.includes(message.targetGroupId)) return;

    let imageUrl = null;
    if (message.type === 'text/image_link') {
        imageUrl = message.body;
    } else if (message.attachments && message.attachments.length > 0) {
        imageUrl = message.attachments[0].link;
    }

    if (imageUrl) {
        console.log(`✅ تم اكتشاف صورة في القناة ${message.targetGroupId}...`);
        const solution = await solveCaptcha(imageUrl);
        
        if (solution) {
            console.log("🔑 سيتم إرسال الحل:", solution);
            await service.messaging.sendGroupMessage(settings.verificationGroupId, `#${solution}`);
        } else {
            console.log("❌ فشل الحل. تأكد أن الصورة واضحة وأن الرابط يعمل.");
        }
    }
});

service.on('ready', async () => {
    console.log("🚀 البوت يعمل الآن ويراقب القنوات...");
});

service.login(process.env.U_MAIL, process.env.U_PASS);
