import 'dotenv/config';
import wolfjs from 'wolf.js';
import axios from 'axios';

const { WOLF } = wolfjs;
const service = new WOLF();

// الإعدادات - تأكد من تعبئة البيانات في ملف .env
const settings = {
    allowedGroupIds: [81889058], // أرقام القنوات المسموح بها
    verificationGroupId: 9969,          // القناة التي يرسل فيها الحل
    apiKey: process.env.API_KEY || 'K83171079488957'
};

// دالة الحل الذكية
async function solveCaptcha(imageUrl) {
    console.log("🔍 جاري معالجة الصورة مكانيّاً...");
    try {
        const response = await axios.post('https://api.ocr.space/parse/image', null, {
            params: { 
                apikey: settings.apiKey, 
                url: imageUrl, 
                language: 'eng', 
                OCREngine: 2,
                filetype: 'JPG',           // حل مشكلة E216
                isOverlayRequired: true    // ضروري لاستخراج الإحداثيات
            },
            timeout: 20000 
        });

        if (response.data.ParsedResults?.length > 0) {
            const overlay = response.data.ParsedResults[0].TextOverlay;
            if (!overlay || !overlay.Lines) return null;

            // 1. استخراج الرموز وإحداثياتها (left)
            let candidates = [];
            overlay.Lines.forEach(line => {
                line.Words.forEach(word => {
                    // نبحث عن كلمات من 3-4 خانات (أرقام وحروف)
                    if (word.WordText.match(/^[A-Z0-9]{3,4}$/i)) {
                        candidates.push({
                            text: word.WordText.toUpperCase(),
                            left: word.Left
                        });
                    }
                });
            });

            // 2. ترتيب الرموز حسب موقعها (من اليسار لليمين)
            candidates.sort((a, b) => a.left - b.left);
            
            console.log("📋 الرموز المرتبة مكانيّاً:", candidates.map(c => c.text));

            // 3. اختيار الحل
            // إذا كان المربع المظلل دائماً هو الأخير في الصورة (من اليسار لليمين)، نستخدم:
            if (candidates.length > 0) {
                const solution = candidates[candidates.length - 1].text;
                console.log("🔑 الحل المختار:", solution);
                return solution;
            }
        }
        return null;
    } catch (err) {
        console.error("❌ خطأ API:", err.message);
        return null;
    }
}

// مراقبة الرسائل
service.on('groupMessage', async (message) => {
    if (!settings.allowedGroupIds.includes(message.targetGroupId)) return;

    let imageUrl = null;
    if (message.type === 'text/image_link') imageUrl = message.body;
    else if (message.attachments && message.attachments.length > 0) imageUrl = message.attachments[0].link;

    if (imageUrl) {
        console.log(`✅ تم اكتشاف صورة في القناة ${message.targetGroupId}`);
        const solution = await solveCaptcha(imageUrl);
        
        if (solution) {
            await service.messaging.sendGroupMessage(settings.verificationGroupId, `#${solution}`);
        }
    }
});

service.on('ready', () => {
    console.log("🚀 البوت متصل وجاهز للعمل!");
});

service.login(process.env.U_MAIL, process.env.U_PASS);
