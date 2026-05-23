import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL || 'your_email@example.com',
    secret: process.env.U_PASS || 'your_password',
    taskGroupId: 81889058, // تأكد من رقم المجموعة
    depositGroupId: 81889058
};

const MY_INFO = {
    myId: "80055399" // العضوية المستهدفة
};

const service = new WOLF();

// دالة لتجهيز الرموز كي لا تسبب مشاكل في البحث (Escape)
const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

service.on('groupMessage', async (message) => {
    try {
        const content = message.body;

        // التحقق من المجموعة
        const isTargetGroup = message.targetGroupId === settings.taskGroupId || message.targetGroupId === settings.depositGroupId;
        if (!isTargetGroup) return;

        // التحقق من أن الرسالة فخ + مطابقة العضوية
        if (content.includes("اختبار تحقق سريع") && content.includes(MY_INFO.myId)) {
            
            // 1. استخراج الرموز (العلامتين) من جملة التعليمات
            // يبحث عن أي رمز غير مسافة يقع قبل وبعد "و"
            const symbolMatch = content.match(/العلامتين\s*([^\s])\s*و?\s*([^\s])/u);

            if (symbolMatch) {
                const sym1 = symbolMatch[1]; // الرمز الأول (مثل ✪)
                const sym2 = symbolMatch[2]; // الرمز الثاني (مثل ◂)
                
                // 2. فصل النص لأخذ ما بعد النقطتين فقط
                // هذا يضمن أننا لا نرى حرف "و" الموجود في التعليمات
                const parts = content.split(':');
                const targetArea = parts.length > 1 ? parts.slice(1).join(':') : content;

                // 3. البحث عن الإجابة المحصورة بين الرموز المستخرجة في منطقة الهدف فقط
                const pattern = new RegExp(`${escapeRegExp(sym1)}(.*?)${escapeRegExp(sym2)}`, 'u');
                const result = targetArea.match(pattern);

                if (result && result[1]) {
                    const answer = result[1].trim();
                    console.log(`✅ تم استخراج الإجابة: ${answer}`);
                    
                    setTimeout(async () => {
                        await service.messaging.sendGroupMessage(message.targetGroupId, `#${answer}`);
                    }, 3000);
                }
            }
        }
    } catch (err) {
        console.error("خطأ في معالجة الفخ:", err);
    }
});

// --- قسم المهام الدورية ---
service.on('ready', async () => {
    console.log(`🚀 البوت يعمل: نظام استخراج الرموز الذكي مفعل.`);
    
    try {
        await service.group.joinById(settings.taskGroupId);
        await service.group.joinById(settings.depositGroupId);

        setInterval(async () => {
            await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد مهام");
            setTimeout(async () => {
                await service.messaging.sendGroupMessage(settings.depositGroupId, "!مد تحالف ايداع كل");
            }, 2000);
        }, 60000); 

        setInterval(async () => {
            await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد صندوق فتح");
        }, 180000); 

    } catch (e) {
        console.error("خطأ في بدء المهام:", e);
    }
});

service.login(settings.identity, settings.secret);
