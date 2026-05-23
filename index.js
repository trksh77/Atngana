import 'dotenv/config';
import wolfjs from 'wolf.js';
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

service.on('groupMessage', async (message) => {
    try {
        const content = message.body;
        const isTargetGroup = message.targetGroupId === settings.taskGroupId || message.targetGroupId === settings.depositGroupId;
        if (!isTargetGroup) return;

        if (content.includes("تحقق") && content.includes(MY_INFO.myId)) {
            
            // --- فخ 1: الرموز (تجاهل الأولى) ---
            if (content.includes("العلامتين")) {
                const symMatch = content.match(/العلامتين\s*([^\s\w\u0600-\u06FF])\s*و\s*([^\s\w\u0600-\u06FF])/u);
                if (symMatch) {
                    const pattern = new RegExp(`${escapeRegExp(symMatch[1])}(.*?)${escapeRegExp(symMatch[2])}`, 'gu');
                    const matches = [...content.matchAll(pattern)];
                    if (matches.length > 0) {
                        const target = matches.length > 1 ? matches[1] : matches[0];
                        await service.messaging.sendGroupMessage(message.targetGroupId, `#${target[1].trim()}`);
                    }
                }
            }
            // --- فخ 2: القوسين () ---
            else if (content.includes("داخل القوسين")) {
                const match = content.match(/\((.*?)\)/);
                if (match) await service.messaging.sendGroupMessage(message.targetGroupId, `#${match[1].trim()}`);
            }
            // --- فخ 3: الأقواس المعقوفة {} ---
            else if (content.includes("الأقواس المعقوفة")) {
                const match = content.match(/\{(.*?)\}/);
                if (match) await service.messaging.sendGroupMessage(message.targetGroupId, `#${match[1].trim()}`);
            }
            // --- فخ 4: الاتجاهات (يمين / يسار) ---
            else if (content.includes("يمين") || content.includes("يسار")) {
                const symMatch = content.match(/للعلامة\s*([^\s])/u);
                const dirMatch = content.match(/(اليمين|يمين|اليسار|يسار)/u);
                if (symMatch && dirMatch) {
                    const regex = new RegExp(`([^\\s]+)\\s*${escapeRegExp(symMatch[1])}\\s*([^\\s]+)`, 'gu');
                    const matches = [...content.matchAll(regex)];
                    if (matches.length > 0) {
                        const target = matches.length > 1 ? matches[1] : matches[0];
                        const answer = dirMatch[0].includes("يمين") ? target[2] : target[1];
                        await service.messaging.sendGroupMessage(message.targetGroupId, `#${answer}`);
                    }
                }
            }
            // --- فخ 5: القوائم المفصولة بـ | (الجديد) ---
            else if (content.includes("الرمز رقم")) {
                const indexMatch = content.match(/رقم\s*(\d+)/u);
                const listMatch = content.match(/⁦(.*?)\s*⁩/u); // التقاط النص بين العلامات الخاصة
                
                if (indexMatch && listMatch) {
                    const items = listMatch[1].split('|').map(s => s.trim());
                    const index = parseInt(indexMatch[1]) - 1; // تحويل من 1-based إلى 0-based
                    
                    if (items[index]) {
                        console.log(`✅ فخ القوائم: العنصر المطلوب هو [${items[index]}]`);
                        await service.messaging.sendGroupMessage(message.targetGroupId, `#${items[index]}`);
                    }
                }
            }
        }
    } catch (err) { console.error("خطأ:", err); }
});

service.on('ready', async () => {
    console.log(`🚀 البوت نشط بكل أنظمة الفخاخ (5/5).`);
    await service.group.joinById(settings.taskGroupId);
    await service.group.joinById(settings.depositGroupId);
});

service.login(settings.identity, settings.secret);
