// server.js - v16.0 (修复双重启动 Bug)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { startBattleSession } = require('./battle_engine');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let users = {};       
let rooms = {};       
let battleLogs = {};  

const genId = () => Math.random().toString(36).substr(2, 6).toUpperCase();

// --- 1. 用户登录 ---
app.post('/api/login', (req, res) => {
    const { address } = req.body;
    let existingRoomId = null;
    Object.values(rooms).forEach(r => {
        if ((r.p1 && r.p1.address === address) || (r.p2 && r.p2.address === address)) {
            existingRoomId = r.id;
        }
    });
    users[address] = { address, status: existingRoomId ? 'fighting' : 'idle', roomId: existingRoomId };
    console.log(`👤 登录: ${address.slice(0,6)}`);
    res.json({ status: "success", roomId: existingRoomId });
});

// --- 2. 大厅列表 ---
app.get('/api/lobby', (req, res) => {
    const list = Object.values(rooms).map(r => ({
        id: r.id,
        name: r.type === 'PvE' ? `PvE #${r.id}` : `Arena #${r.id}`,
        p1: r.p1 ? { address: r.p1.address, hero: r.p1.hero } : null,
        status: r.status,
        type: r.type,
        spectators: r.spectators ? r.spectators.length : 0
    }));
    const activeList = list.filter(r => r.status !== 'finished');
    res.json({ rooms: activeList });
});

// --- 3. 创建/加入/观战 ---
app.post('/api/join-room', (req, res) => {
    const { address, chain, roomId, action } = req.body; 
    let room;
    if (action === 'create') {
        const newId = genId();
        rooms[newId] = {
            id: newId,
            p1: { address, chain, ready: false, hero: null },
            p2: null,
            spectators: [],
            type: 'PvP',
            status: 'waiting',
            battleStarted: false // 🔥 新增：防止重复启动锁
        };
        room = rooms[newId];
        console.log(`🏠 创建 PvP: ${newId}`);
    } else {
        room = rooms[roomId];
        if (!room) return res.json({ error: "房间不存在" });
    }

    if(users[address]) users[address].roomId = room.id;

    if (action === 'join') {
        if (!room.p2) room.p2 = { address, chain, ready: false, hero: null };
        else return res.json({ error: "房间已满" });
    } else if (action === 'spectate') {
        if (!room.spectators.includes(address)) room.spectators.push(address);
    }
    res.json({ status: "success", roomId: room.id, role: action === 'spectate' ? 'spectator' : 'player' });
});

// --- 4. PvE 模式 ---
app.post('/api/pve', (req, res) => {
    const { address, chain, heroId } = req.body;
    const roomId = "PvE_" + genId();
    
    const heroes = ['WARRIOR', 'MAGE', 'PALADIN'];
    let aiHero = heroes[Math.floor(Math.random() * heroes.length)];
    if (aiHero === heroId) aiHero = heroes.find(h => h !== heroId) || 'WARRIOR';

    rooms[roomId] = {
        id: roomId,
        p1: { address, chain, ready: true, hero: heroId }, 
        p2: { address: "0xAI_AGENT", chain: chain==='Base'?'Eth':'Base', ready: true, hero: aiHero },
        spectators: [],
        type: 'PvE',
        status: 'fighting',
        battleStarted: false // 🔥 新增锁
    };
    
    if(users[address]) users[address].roomId = roomId;
    
    console.log(`🤖 PvE 创建: ${roomId}`);
    // PvE 创建即开始
    startBattle(roomId);
    
    res.json({ status: "success", roomId });
});

// --- 5. 准备 (PvP) ---
app.post('/api/ready', (req, res) => {
    const { address, heroId } = req.body;
    const user = users[address];
    if (!user || !user.roomId) return res.json({ error: "无房间" });
    const room = rooms[user.roomId];
    if (!room) return res.json({ error: "房间不存在" });

    if (room.p1 && room.p1.address === address) { room.p1.ready = true; room.p1.hero = heroId; }
    if (room.p2 && room.p2.address === address) { room.p2.ready = true; room.p2.hero = heroId; }

    // 只有 PvP 需要在这里触发，PvE 已经在创建时触发了
    if (room.type === 'PvP' && room.p1 && room.p1.ready && room.p2 && room.p2.ready) {
        room.status = 'fighting';
        startBattle(room.id);
    }
    res.json({ status: "success" });
});

// --- 6. 退出 ---
app.post('/api/leave-room', (req, res) => {
    const { address } = req.body;
    const user = users[address];
    if (!user || !user.roomId) return res.json({ status: "success" });

    const roomId = user.roomId;
    const room = rooms[roomId];

    if (room) {
        if (room.p1 && room.p1.address === address) room.p1 = null;
        if (room.p2 && room.p2.address === address) room.p2 = null;
        if (room.spectators) room.spectators = room.spectators.filter(s => s !== address);

        if (!room.p1 && !room.p2) {
            console.log(`🗑️ 销毁: ${roomId}`);
            delete rooms[roomId];
            delete battleLogs[roomId];
        }
    }
    user.roomId = null;
    res.json({ status: "success" });
});

// --- 7. 状态查询 ---
app.get('/api/room-status/:roomId', (req, res) => {
    const room = rooms[req.params.roomId];
    if (!room) return res.json({ status: 'closed' });
    const logs = battleLogs[room.id] || [];
    return res.json({ status: room.status, room: { id: room.id, p1: room.p1, p2: room.p2, winner: room.winner }, logs });
});

// 🔥 核心修复：启动器加锁
function startBattle(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    // 🛑 关键判断：如果已经开始了，绝对不要再开第二个线程！
    if (room.battleStarted) {
        console.log(`⚠️ 阻止了房间 ${roomId} 的重复启动请求`);
        return; 
    }
    
    room.battleStarted = true; // 上锁
    battleLogs[roomId] = [];
    
    console.log(`⚔️ 启动战斗引擎: ${roomId}`);
    startBattleSession(room, (msg) => {
        const time = new Date().toLocaleTimeString();
        battleLogs[roomId].push({ time, msg });
    });
}

app.listen(3000, () => console.log('🚀 Server running on port 3000'));