const MAX_TURNS = 6;
const INITIAL_SPAWNS = [
    {turn:1,lane:0,name: "Goblin Sapper", hp: 35, atk: 20},
    {turn: 1, lane:2, name: "Orc Raider", hp: 45,atk:22},
    {turn: 2, lane: 1, name: "Battering Ram", hp: 65, atk:30},
    {turn: 3, lane:0,name: "Flame Catapult", hp: 40, atk:25},
    {turn: 4, lane: 2,name: "Siege Ogre", hp: 70, atk: 32},
    {turn: 5, lane:1,name: "Warlord", hp: 80,atk: 35}
];
let state = {};
let previewMode = null;
const turnDisplay = document.getElementById("turn-display");
const timberVal = document.getElementById("timber-val");
const ironVal = document.getElementById("iron-val");
const manaVal = document.getElementById("mana-val");
const laneslist = document.getElementById("lanes-list");
const statusLog = document.getElementById("status-log");
const selectedLaneLabel = document.getElementById("selected-lane-label");
const repairBtn = document.getElementById("repair-btn");
const ballistaBtn = document.getElementById("ballista-btn");
const arcaneBtn = document.getElementById("arcane-btn");
const endTurnBtn = document.getElementById("end-turn-btn");
const resetBtn = document.getElementById("reset-btn");
const audioToggleBtn = document.getElementById("audio-toggle");
let soundEnabled = true;
let audioCtx = null;
function selectLane(idx){
    if (idx < 0 || idx >= state.lanes.length) return;
    state.selectedLane = idx;
    SoundFX.select();
    render();
}
function initGame(){
    previewMode = null;
    state = {
        turn :1,
        selectedLane:0,
        timber:4,
        iron:4,
        mana: 3,
        gameOver: false,
        spawns: INITIAL_SPAWNS.map((s)=> ({...s})),
        lanes:[
            {name: "NORTH GATE", hp: 100, maxHp: 100, enemies: []},
            {name: "CENTRAL KEEP", hp: 100, maxHp: 100, enemies: []},
            {name: "SOUTH BASTION", hp: 100, maxHp: 100,enemies: []}
        ]
    };
    spawnEnemiesForTurn(1);
    statusLog.textContent = "Select a lane and issue an order, or end the turn.";
    render();
}
function spawnEnemiesForTurn(turn){
    state.spawns
        .filter((s)=> s.turn === turn)
        .forEach((unit)=>{
            const lane = state.lanes[unit.lane];
            const occupied = new Set(lane.enemies.map((e)=> e.pos));
            let pos = 3
            while (pos >= 0&& occupied.has(pos)) pos--;
            if (pos >= 0){
                lane.enemies.push({
                    name: unit.name,
                    hp: unit.hp,
                    atk: unit.atk,
                    pos,
                    stunned: false
                });
            }
        });
    state.spawns =  state.spawns.filter((s)=> s.turn > turn);
}
function repairWall(){
    const lane = state.lanes[state.selectedLane];
    if (state.gameOver||state.timber<2||lane.hp >= lane.maxHp){
        SoundFX.error();
        return;
    }
    state.timber -=2;
    lane.hp = Math.min(lane.maxHp, lane.hp + 25);
    SoundFX.repair();
    statusLog.textContent = `Fortified ${lane.name} (+25HP).`;
    render();
}
function fireBallista(){
    const lane = state.lanes[state.selectedLane];
    if (state.gameOver||state.iron < 2||lane.enemies.length === 0){
        SoundFX.error();
        return;
    }
    state.iron -=2;
    lane.enemies.sort((a,b)=> a.pos - b.pos);
    const target = lane.enemies[0];
    target.hp -= 35;
    SoundFX.ballista();
    if (target.hp <=0){
        lane.enemies.shift();
        statusLog.textContent = `Ballista destroyed ${target.name} in ${lane.name}`;
    } else {
        statusLog.textContent = `Ballista hit ${target.name} for 35 damage`;
    }
    render();
}
function castArcaneNova(){
    const lane = state.lanes[state.selectedLane];
    if (state.gameOver || state.mana <2 || lane.enemies.length === 0) {
        SoundFX.error();
        return;
    }
    state.mana -= 2;
    lane.enemies = lane.enemies.filter((enemy)=>{
        enemy.hp -= 25;
        if (enemy.hp > 0){
            enemy.stunned = true;
            return true;
        }
        return false;
    });
    SoundFX.arcane();
    statusLog.textContent = `Arcane Nova hit all enemies in ${lane.name}`;
    render();
}
function endTurn(){
    previewMode = null;
    if (state.gameOver) return;
    state.lanes.forEach((lane)=>{
        lane.enemies.sort((a,b) =>a.pos-b.pos);
        lane.enemies.forEach((enemy,idx)=>{
            if (enemy.stunned){
                enemy.stunned = false;
                return;
            }
            if (enemy.pos === 0){
                lane.hp = Math.max(0, lane.hp - enemy.atk);
            } else {
                const blocked = lane.enemies.some((o,i)=> i < idx && o.pos === enemy.pos-1);
                if (!blocked) enemy.pos -=1;
            }
        });
    });
    const breached = state.lanes.find((l)=>l.hp<=0);
    if (breached){
        state.gameOver = true;
        SoundFX.defeat();
        statusLog.textContent = `DEFEAT: ${breached.name} was breached!`;
        render();
        return;
    }
    const totalEnemies = state.lanes.reduce((sum,l)=> sum + l.enemies.length,0);
    if (state.turn >= MAX_TURNS && totalEnemies === 0){
        state.gameOver = true;
        SoundFX.victory();
        statusLog.textContent = "VICTORY: The citadel held against the siege!";
        render();
        return;
    }
    if (state.turn < MAX_TURNS){
        state.turn +=1;
    }
    state.timber +=2;
    state.iron +=2;
    state.mana +=2;
    spawnEnemiesForTurn(state.turn);
    SoundFX.turn();
    statusLog.textContent = "Turn ended. Enemies advanced and +2 supplies arrived.";
    render();
}
function playSound (freq, duration = 0.12, type = "triangle", volume = 0.08){
    if (!soundEnabled) return;
    try{
        if (!audioCtx){
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === "suspended"){
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
}
const SoundFX = {
    select: () =>playSound(420,0.06, "sine", 0.05),
    repair: () => playSound(310, 0.15,"triangle",0.09),
    ballista: () =>playSound(190,0.16,"square",0.07),
    arcane: () => playSound(540,0.22,"sine",0.09),
    turn: () => playSound(260,0.11,"triangle", 0.06),
    error: ()=>playSound(140,0.1,"sawtooth", 0.05),
    victory: () =>{
        playSound(523,0.14,"triangle",0.08);
        setTimeout(()=> playSound(659,0.14,"triangle",0.08),110);
        setTimeout(()=> playSound(784,0.24,"triangle",0.09), 220);
    },
    defeat: ()=>{
        playSound(220, 0.18, "sawtooth", 0.08);
        setTimeout(()=> playSound(150, 0.28, "sawtooth",0.08),150);
    }
};
function getLaneThreat(lane){
    return lane.enemies.reduce((sum,enemy)=>{
        if (!enemy.stunned && enemy.pos === 0){
            return sum + enemy.atk;
        }
        return sum;
    }, 0);
}
function getFrontEnemy(lane){
    if (!lane || lane.enemies.length === 0) return null;
    return [...lane.enemies].sort((a,b) => a.pos - b.pos)[0];
}
function setPreview(mode){
    previewMode = mode;
    render();
}
function renderPreviewText(activeLane){
    if (state.gameOver || !previewMode) return;
    if (previewMode === "repair"){
        const gain = Math.min(25, activeLane.maxHp - activeLane.hp);
        statusLog.textContent = gain > 0 ? `Preview: Fortify ${activeLane.name} for +${gain} Wall HP (-2 Timber).` : `Preview: ${activeLane.name} is already at full Wall HP.`;
    } else if (previewMode === "ballista"){
        const target = getFrontEnemy(activeLane);
        if (!target){
            statusLog.textContent = `Preview: No enemies in ${activeLane.name} to target.`
        } else {
            const afterHp = Math.max(0, target.hp - 35);
            statusLog.textContent = `Preview: Ballista hits ${target.name} for 35 DMG (${target.hp} -> ${afterHp} HP).`;
        }
    } else if (previewMode === "arcane"){
        if (activeLane.enemies.length === 0){
            statusLog.textContent = `Preview: No enemies in ${activeLane.name} for Arcane Nova.`;
        } else{
            statusLog.textContent = `Preview: Arcane Nova hits ${activeLane.enemies.length} enemy/enemies in ${activeLane.name} for 25 DMG & Stun.`;
        }
    }
}
function getEnemyTelegraph(lane,enemy){
    if (enemy.stunned){
        return { text: "STUNNED (SKIP)", isStrike: false};
    }
    if (enemy.pos === 0){
        return {text: `STRIKE WALL (-${enemy.atk} HP)`, isStrike: true};
    }
    const blocked = lane.enemies.some((other)=> other !== enemy && other.pos === enemy.pos - 1);
    if (blocked){
        return { text: "BLOCKED", isStrike: false};
    }
    const nextPos = enemy.pos - 1;
    return{
        text: nextPos === 0 ? "ADVANCE --> WALL" : `ADVANCE --> TILE ${nextPos}`,
        isStrike: false
    };
}
function render(){
    turnDisplay.textContent = `TURN ${Math.min(state.turn, MAX_TURNS)}/${MAX_TURNS}`;
    timberVal.textContent = state.timber;
    ironVal.textContent = state.iron;
    manaVal.textContent = state.mana;
    laneslist.innerHTML = "";
    const active = state.lanes[state.selectedLane];
    repairBtn.disabled = state.gameOver || state.timber < 2 || active.hp >= active.maxHp;
    ballistaBtn.disabled = state.gameOver || state.iron < 2 || active.enemies.length === 0;
    arcaneBtn.disabled = state.gameOver || state.mana < 2 || active.enemies.length === 0;
    state.lanes.forEach((lane,idx)=>{
        const isSelected = idx === state.selectedLane;
        const threat = getLaneThreat(lane);
        const frontEnemy = isSelected ? getFrontEnemy(lane) : null;
        const laneEl = document.createElement("div");
        laneEl.className = `lane ${idx === state.selectedLane ? "selected" : ""} ${isSelected && previewMode === "repair" && !repairBtn.disabled ? "repair-preview" : ""}`;
        laneEl.onclick = () => selectLane(idx);
        const infoEl = document.createElement("div");
        infoEl.className = "lane-info";
        infoEl.innerHTML = `<strong>${lane.name}</strong><span>WALL HP: ${lane.hp}/${lane.maxHp}</span><span class="lane-threat ${threat > 0 ? "danger": ""}"> ${threat > 0 ? `Incoming -${threat} HP` : "Incoming 0 HP"}</span>`;
        const trackEl = document.createElement("div");
        trackEl.className = "lane-track";
        for (let pos = 0; pos <4; pos++){
            const slot = document.createElement("div");
            slot.className = "slot";
            const enemy = lane.enemies.find((e)=> e.pos === pos);
            if (enemy){
                const telegraph = getEnemyTelegraph(lane,enemy);
                let previewClass = "";
                if (isSelected && !state.gameOver){
                    if (previewMode === "ballista" && !ballistaBtn.disabled && frontEnemy === enemy){
                        previewClass = "target-preview";
                    } else if (previewMode === "arcane" && !arcaneBtn.disabled){
                        previewClass = "aoe-preview";
                    }
                }
                slot.innerHTML = `
                <div class="enemy ${enemy.stunned ? "stunned" : ""}">
                    <strong>${enemy.name}</strong><br>
                    HP: ${enemy.hp} | ATK: ${enemy.atk}
                    <div class="enemy-intent ${telegraph.isStrike ? "strike" : ""}"> ${telegraph.text}</div>
                </div>
                `;
            } else {
                slot.textContent = pos === 0?"WALL" : `Tile ${pos}`;
            }
            trackEl.appendChild(slot);
        }
        laneEl.appendChild(infoEl);
        laneEl.appendChild(trackEl);
        laneslist.appendChild(laneEl);
    });
    selectedLaneLabel.textContent = `LANE: ${active.name}`;
    renderPreviewText(active);
}
repairBtn.onmouseenter = () => setPreview("repair");
repairBtn.onmouseleave = () => setPreview(null);
repairBtn.onfocus = () => setPreview("repair");
repairBtn.onblur = () => setPreview(null);
repairBtn.onclick = repairWall;
ballistaBtn.onmouseenter = () => setPreview("ballista");
ballistaBtn.onmouseleave = () => setPreview(null);
ballistaBtn.onfocus = () => setPreview("ballista");
ballistaBtn.onblur = () => setPreview(null);
ballistaBtn.onclick = fireBallista;
arcaneBtn.onmouseenter = () => setPreview("arcane");
arcaneBtn.onmouseleave = () => setPreview(null);
arcaneBtn.onfocus = () => setPreview("arcane");
arcaneBtn.onblur = () => setPreview(null);
arcaneBtn.onclick = castArcaneNova;
endTurnBtn.onclick = endTurn;
resetBtn.onclick = () => {
    SoundFX.select();
    initGame();
};
audioToggleBtn.onclick = () =>{
    soundEnabled = !soundEnabled;
    audioToggleBtn.textContent = `SOUND: ${soundEnabled ? "ON" : "OFF"}`;
    if (soundEnabled) SoundFX.select();
};
document.addEventListener("keydown", (e)=>{
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const key = e.key.toLowerCase();
    if (key === "1") selectLane(0);
    else if (key === "2") selectLane(1);
    else if (key === "3") selectLane(2);
    else if (key === "q") repairWall();
    else if (key === "w") fireBallista();
    else if (key === "e") castArcaneNova();
    else if (e.code === "Space" || key === " "){
        e.preventDefault();
        endTurn();
    } else if (key === "r"){
        SoundFX.select();
        initGame();
    }
});
initGame();