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
function initGame(){
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
    if (state.gameOver||state.timber<2||lane.hp >= lane.maxHp) return;
    state.timber -=2;
    lane.hp = Math.min(lane.maxHp, lane.hp + 25);
    statusLog.textContent = `Fortified ${lane.name} (+25HP).`;
    render();
}
function fireBallista(){
    const lane = state.lanes[state.selectedLane];
    if (state.gameOver||state.iron < 2||lane.enemies.length === 0)return;
    state.iron -=2;
    lane.enemies.sort((a,b)=> a.pos - b.pos);
    const target = lane.enemies[0];
    target.hp -= 35;
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
    if (state.gameOver || state.mana <2 || lane.enemies.length === 0) return;
    state.mana -= 2;
    lane.enemies = lane.enemies.filter((enemy)=>{
        enemy.hp -= 25;
        if (enemy.hp > 0){
            enemy.stunned = true;
            return true;
        }
        return false;
    });
    statusLog.textContent = `Arcane Nova hit all enemies in ${lane.name}`;
    render();
}
function endTurn(){
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
        statusLog.textContent = `DEFEAT: ${breached.name} was breached!`;
        render();
        return;
    }
    const totalEnemies = state.lanes.reduce((sum,l)=> sum + l.enemies.length,0);
    if (state.turn >= MAX_TURNS && totalEnemies === 0){
        state.gameOver = true;
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
    statusLog.textContent = "Turn ended. Enemies advanced and +2 supplies arrived.";
    render();
}
function render(){
    turnDisplay.textContent = `TURN ${Math.min(state.turn, MAX_TURNS)}/${MAX_TURNS}`;
    timberVal.textContent = state.timber;
    ironVal.textContent = state.iron;
    manaVal.textContent = state.mana;
    laneslist.innerHTML = "";
    state.lanes.forEach((lane,idx)=>{
        const laneEl = document.createElement("div");
        laneEl.className = `lane ${idx === state.selectedLane ? "selected" : ""}`;
        laneEl.onclick = () => {
            state.selectedLane = idx;
            render();
        };
        const infoEl = document.createElement("div");
        infoEl.className = "lane-info";
        infoEl.innerHTML = `<strong>${lane.name}</strong><span>WALL HP: ${lane.hp}/${lane.maxHp}</span>`;
        const trackEl = document.createElement("div");
        trackEl.className = "lane-track";
        for (let pos = 0; pos <4; pos++){
            const slot = document.createElement("div");
            slot.className = "slot";
            const enemy = lane.enemies.find((e)=> e.pos === pos);
            if (enemy){
                slot.innerHTML = `
                <div class="enemy ${enemy.stunned ? "stunned" : ""}">
                    <strong>${enemy.name}</strong><br>
                    HP: ${enemy.hp} | ATK: ${enemy.atk}
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
    const active = state.lanes[state.selectedLane];
    selectedLaneLabel.textContent = `LANE: ${active.name}`;
    repairBtn.disabled = state.gameOver || state.timber < 2 || active.hp >= active.maxHp;
    ballistaBtn.disabled = state.gameOver || state.iron < 2 || active.enemies.length === 0;
    arcaneBtn.disabled = state.gameOver || state.mana < 2 || active.enemies.length ===0;
}
repairBtn.onclick = repairWall;
ballistaBtn.onclick = fireBallista;
arcaneBtn.onclick = castArcaneNova;
endTurnBtn.onclick = endTurn;
resetBtn.onclick = initGame;
initGame();