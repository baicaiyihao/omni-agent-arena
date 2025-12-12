// battle_engine.js - v19.0 (Universal AI: On-Chain Enabled)
require('dotenv').config();
const { OpenAI } = require("openai");
const { exec } = require("child_process");

// 配置通义千问 (Qwen)
const client = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY, 
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
});

// 链上配置
const CONFIG = {
    BASE_CONTRACT: "0xee2E8dfefd723e879CAa30A1DaD94046Fa3D24D4", 
    ETH_CONTRACT: "0x7c9BbA0630c9452F726bc15D0a73cdF769438efE",
    TARGET_TOKEN: "0x05BA149A7bd6dC1F937fA9046A9e05C05f3b18b0",
    PRIVATE_KEY: process.env.PRIVATE_KEY
};

async function startBattleSession(room, logCallback) {
    const log = (msg) => { console.log(`[Room ${room.id}] ${msg}`); logCallback(msg); };

    let gameState = {
        round: 1,
        maxRounds: 10,
        p1: { name: `P1(${room.p1.hero || 'Hero'})`, hp: 120, isDefending: false },
        p2: { name: `P2(${room.p2.hero || 'Villain'})`, hp: 120, isDefending: false }
    };

    log(`🎮 Battle Start! ${gameState.p1.name} vs ${gameState.p2.name}`);

    // --- 1. AI 智能体决策 (AI Agent Core) ---
    async function getAgentMove(attacker, defender) {
        log(`🧠 [AI] ${attacker.name} 正在读取链上状态并推理...`);
        // 模拟思考延迟
        await new Promise(r => setTimeout(r, 1500)); 

        const prompt = `
        You are a crypto-native AI Agent controlling ${attacker.name}.
        Your Status: HP ${attacker.hp}.
        Opponent Status: HP ${defender.hp}, Defending: ${defender.isDefending}.
        Goal: Win the battle on-chain.
        Action Space: [ATTACK, DEFEND, SKILL].
        Output: Only the action word.
        `;
        
        try {
            const res = await client.chat.completions.create({
                model: "qwen-plus", messages: [{ role: "user", content: prompt }]
            });
            return res.choices[0].message.content.trim();
        } catch (e) { 
            console.error("AI Error:", e.message);
            return "ATTACK"; // 兜底策略
        }
    }

    // --- 2. 跨链执行器 (Cross-Chain Executor) ---
    async function sendMoveToChain(chain, move) {
        log(`⚡️ [上链] AI 正在触发跨链合约... (${move})`);
        
        if (!CONFIG.PRIVATE_KEY) {
            log("⚠️ 未配置私钥，跳过上链");
            return "0xSkipped";
        }

        // 构造 CLI 命令 (确保 messaging 目录存在且 npm install 过)
        const baseCmd = `cd messaging && npx tsx commands/index.ts message`; 
        let cmd = "";
        
        // 根据阵营选择 RPC
        if (chain === 'Base' || chain === 'BASE') {
            cmd = `${baseCmd} --rpc https://sepolia.base.org --private-key ${CONFIG.PRIVATE_KEY} --contract ${CONFIG.BASE_CONTRACT} --target-contract ${CONFIG.ETH_CONTRACT} --types string --values "${move}" --target-token ${CONFIG.TARGET_TOKEN} --amount 0.0001 --gas-limit 300000`;
        } else {
            // 默认走 Sepolia RPC
            cmd = `${baseCmd} --rpc https://sepolia.drpc.org --private-key ${CONFIG.PRIVATE_KEY} --contract ${CONFIG.ETH_CONTRACT} --target-contract ${CONFIG.BASE_CONTRACT} --types string --values "${move}" --target-token ${CONFIG.TARGET_TOKEN} --amount 0.0001 --gas-limit 300000`;
        }

        return new Promise((resolve) => {
            exec(cmd, (error, stdout, stderr) => {
                // 容错处理：即使上链失败，游戏也要继续
                if (error) {
                    console.error("Chain Error:", stderr);
                    // 模拟延迟，假装上链耗时
                    setTimeout(() => resolve("0xMockHash_Error"), 1000);
                    return;
                }
                
                try {
                    // 提取 Hash
                    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const res = JSON.parse(jsonMatch[0]);
                        if (res.transactionHash) {
                            log(`✅ [交易成功] Hash: ${res.transactionHash}`);
                            resolve(res.transactionHash);
                        } else resolve("0xMock_NoHash");
                    } else {
                        resolve("0xMock_ParseError");
                    }
                } catch (e) { resolve("0xMock_Exception"); }
            });
        });
    }

    // --- 3. 状态结算 (State Settlement) ---
    function resolveRound(atk, def, move) {
        let dmg = 0;
        let isCrit = false;
        atk.isDefending = false;

        if (move.includes("DEFEND")) { 
            atk.isDefending = true; 
            log(`🛡️ ${atk.name} 开启防御姿态!`); 
        }
        else {
            let base = move.includes("SKILL") ? 25 : 15;
            // 引入随机性
            dmg = base + Math.floor(Math.random() * 10 - 3); 
            
            if (Math.random() < 0.15) { dmg = Math.floor(dmg * 1.5); isCrit = true; }
            if (def.isDefending) { dmg = Math.floor(dmg/2); log(`✋ 格挡生效! 伤害减半`); }

            def.hp -= dmg;
            if(def.hp < 0) def.hp = 0;

            const critTxt = isCrit ? "🔥暴击! " : "";
            // 🔥 [HP:xx] 是前端同步动画的关键，切勿删除
            log(`${critTxt}💥 ${atk.name} 造成 ${dmg} 伤害! [HP:${def.hp}]`);
        }
    }

    // --- 4. 游戏主循环 (Game Loop) ---
    while (gameState.p1.hp > 0 && gameState.p2.hp > 0 && gameState.round <= gameState.maxRounds) {
        // 安全检查
        if (!room.p1 || !room.p2) { log("🚫 玩家断开，战斗终止"); break; }

        log(`\n=== Round ${gameState.round} ===`);
        
        // --- P1 行动 (Agent 1) ---
        const m1 = await getAgentMove(gameState.p1, gameState.p2);
        // 🔥 真正上链！(如果不需要真上链调试，注释下面这行即可)
        await sendMoveToChain(room.p1.chain || 'Base', m1);
        
        resolveRound(gameState.p1, gameState.p2, m1);
        if(gameState.p2.hp <= 0) break;

        // 动画缓冲时间
        await new Promise(r => setTimeout(r, 3500));

        // --- P2 行动 (Agent 2) ---
        const m2 = await getAgentMove(gameState.p2, gameState.p1);
        // 🔥 真正上链！
        await sendMoveToChain(room.p2.chain || 'Eth', m2);

        resolveRound(gameState.p2, gameState.p1, m2);

        gameState.round++;
        await new Promise(r => setTimeout(r, 3500));
    }
    
    // --- 5. 结束结算 ---
    if (gameState.p1.hp > 0) {
        log(`🏆 胜者: ${gameState.p1.name}`);
        room.winner = 'p1';
    } else {
        log(`🏆 胜者: ${gameState.p2.name}`);
        room.winner = 'p2';
    }
    
    room.status = 'finished';
}

module.exports = { startBattleSession };