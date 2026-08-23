// --- ИНИЦИАЛИЗАЦИЯ TELEGRAM WEB APP ---
const tg = window.Telegram.WebApp;
tg.expand();
const tgId = tg.initDataUnsafe?.user?.id || 123456789;

// --- URL БЭКЕНДА ---
const API_URL = "http://127.0.0.1:5000/api/user";

// --- ГЛОБАЛЬНЫЕ ДАННЫЕ И СОСТОЯНИЕ (Объявлены строго вверху) ---
let userCoins = 0;
let userXP = 0;
let userLevel = 1;

let notepadTotalTasks = 0;
let notepadDoneTasks = 0;
let shopDegradation = 0; 
let physicalBattery = 100;
let socialBattery = 100;

let waterMl = 0;
const waterMax = 2500;
let waterBonusGiven = false;

let tiktokMins = 0;
const tiktokMax = 45;

let obsidianCheckboxState = [false, false, false, false];
let gymCheckboxState = [false, false];
let gymMacrosState = { pro: 0, carbs: 0, cal: 0, penalty: false, bonus: false, calBonus: false };

let lastNotepadCoins = 0;
let lastNotepadXP = 0;
let lastGymCoins = 0;
let lastGymXP = 0;

let toastTimeout;

// --- СИНХРОНИЗАЦИЯ С СЕРВЕРОМ ---
async function syncDataWithServer() {
    const payload = {
        tg_id: tgId,
        coins: userCoins,
        xp: userXP,
        level: userLevel,
        state: {
            waterMl, tiktokMins, 
            physicalBattery, socialBattery, shopDegradation,
            notepadTotalTasks, notepadDoneTasks,
            obsidianCheckboxState, gymCheckboxState, gymMacrosState
        }
    };

    try {
        await fetch(`${API_URL}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Ошибка синхронизации:", err);
    }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function getMaxXP(lvl) {
    let xp = 200;
    for (let i = 1; i < lvl; i++) {
        xp = Math.floor(xp * 1.5);
    }
    return xp;
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.innerText = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function updateCharts() {
    let obsDone = obsidianCheckboxState.filter(v => v).length;
    let obsNotDone = 4 - obsDone;

    let noteNotDone = Math.max(0, notepadTotalTasks - notepadDoneTasks);
    let waterRatio = waterMl / waterMax; 
    
    let tkPenaltyMins = Math.max(0, tiktokMins - tiktokMax); 
    let tkRatio = Math.min(1, tiktokMins / tiktokMax); 

    let gymDone = gymCheckboxState.filter(v => v).length;
    let gymNotDone = 2 - gymDone;
    let gymPenalty = gymMacrosState.penalty ? 20 : 0;
    let gymBonus = gymMacrosState.bonus ? 10 : 0; 
    let calBonus = gymMacrosState.calBonus ? 10 : 0;

    let green = 10 
        + (obsDone * 15) 
        + (notepadDoneTasks * 15) 
        + (gymDone * 15) + gymBonus + calBonus
        + (waterRatio * 20) 
        + (physicalBattery / 100 * 15) 
        + (socialBattery / 100 * 15);

    let red = 10 
        + (obsNotDone * 5) 
        + (noteNotDone * 10) 
        + (gymNotDone * 5) + gymPenalty
        + (tkRatio * 10) 
        + (tkPenaltyMins * 5) 
        + shopDegradation; 

    let blue = 10
        + ((100 - physicalBattery) / 100 * 25)
        + ((100 - socialBattery) / 100 * 25)
        + (obsDone * 5)
        + (notepadDoneTasks * 5)
        + (gymDone * 5);

    let totalPie = green + red + blue;
    let redPct = (red / totalPie) * 100;
    let greenPct = (green / totalPie) * 100;

    const pieChart = document.querySelector('.pie-chart');
    if (pieChart) {
        pieChart.style.background = `conic-gradient(
            var(--accent-red) 0% ${redPct}%,
            var(--accent-green) ${redPct}% ${redPct + greenPct}%,
            var(--accent-blue) ${redPct + greenPct}% 100%
        )`;
    }

    let totalMorality = green + red;
    let successPct = (green / totalMorality) * 100;
    
    const moralityFill = document.querySelector('.morality-bar-fill');
    if (moralityFill) {
        moralityFill.style.width = `${successPct}%`;

        if(successPct > 70) {
            moralityFill.style.boxShadow = '0 0 20px rgba(50, 215, 75, 0.6)';
            moralityFill.style.backgroundColor = 'var(--accent-green)';
        } else if(successPct < 40) {
            moralityFill.style.boxShadow = '0 0 20px rgba(255, 69, 58, 0.6)';
            moralityFill.style.backgroundColor = 'var(--accent-red)';
        } else {
            moralityFill.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)';
            moralityFill.style.backgroundColor = '#ffffff';
        }
    }
}

function updateProfileUI(shouldSync = true) {
    let currentMaxXP = getMaxXP(userLevel);

    while(userXP >= currentMaxXP && userLevel < 15) {
        userXP -= currentMaxXP;
        userLevel++;
        currentMaxXP = getMaxXP(userLevel);
    }
    if (userLevel === 15 && userXP > currentMaxXP) {
        userXP = currentMaxXP; 
    }

    while(userXP < 0) {
        if (userLevel > 1) {
            userLevel--;
            currentMaxXP = getMaxXP(userLevel);
            userXP += currentMaxXP;
        } else {
            userXP = 0; 
            break;
        }
    }
    
    if (userCoins < 0) userCoins = 0;

    currentMaxXP = getMaxXP(userLevel);
    
    const profileCoinsEl = document.getElementById('profile-coins');
    const profileLvlEl = document.getElementById('profile-lvl');
    const profileXpTextEl = document.getElementById('profile-xp-text');
    const profileXpBarEl = document.getElementById('profile-xp-bar');
    const badge = document.getElementById('nav-badge-val');

    if (profileCoinsEl) profileCoinsEl.innerText = userCoins;
    if (profileLvlEl) profileLvlEl.innerText = userLevel;
    if (profileXpTextEl) profileXpTextEl.innerText = `${userXP} / ${currentMaxXP}`;
    
    if (profileXpBarEl) {
        let xpPercent = Math.min(100, (userXP / currentMaxXP) * 100);
        profileXpBarEl.style.width = `${xpPercent}%`;
    }

    const tasksTab = document.querySelector('.nav-item[data-target="page-tasks"]');
    if (badge && tasksTab && !tasksTab.classList.contains('active')) {
        badge.innerText = userCoins;
    }

    updateCharts(); 
    if (shouldSync) {
        syncDataWithServer();
    }
}

function syncUIStates() {
    // 1. Obsidian
    const obsChecks = document.querySelectorAll('.obsidian-check');
    obsChecks.forEach((chk, i) => chk.checked = !!obsidianCheckboxState[i]);
    
    const obsCount = document.getElementById('obsidian-count');
    if (obsCount) obsCount.innerText = obsidianCheckboxState.filter(v => v).length;
    
    const obsDot = document.getElementById('obsidian-status');
    if (obsDot) {
        obsidianCheckboxState.filter(v => v).length === 4 
            ? obsDot.classList.add('status-green') 
            : obsDot.classList.remove('status-green');
    }

    // 2. Notepad
    const noteTotalEl = document.getElementById('notepad-total');
    const noteDoneEl = document.getElementById('notepad-done');
    const noteCountEl = document.getElementById('notepad-count');
    const noteDot = document.getElementById('notepad-status');

    if (noteTotalEl) noteTotalEl.value = notepadTotalTasks || '';
    if (noteDoneEl) noteDoneEl.value = notepadDoneTasks || '';
    if (noteCountEl) noteCountEl.innerText = `${notepadDoneTasks}/${notepadTotalTasks}`;
    if (noteDot) {
        (notepadTotalTasks > 0 && notepadDoneTasks === notepadTotalTasks) 
            ? noteDot.classList.add('status-green') 
            : noteDot.classList.remove('status-green');
    }
    
    let notDone = Math.max(0, notepadTotalTasks - notepadDoneTasks);
    let score = notepadDoneTasks - notDone;
    lastNotepadCoins = score * 10;
    lastNotepadXP = score * 10 * 1.5;

    // 3. Gym
    const gymChecks = document.querySelectorAll('.gym-check');
    gymChecks.forEach((chk, i) => chk.checked = !!gymCheckboxState[i]);
    
    const gymCountEl = document.getElementById('gym-count');
    if (gymCountEl) gymCountEl.innerText = gymCheckboxState.filter(v => v).length;
    
    const gymCal = document.getElementById('gym-cal');
    const gymPro = document.getElementById('gym-pro');
    const gymCarbs = document.getElementById('gym-carbs');
    if (gymCal) gymCal.value = gymMacrosState.cal || '';
    if (gymPro) gymPro.value = gymMacrosState.pro || '';
    if (gymCarbs) gymCarbs.value = gymMacrosState.carbs || '';

    const gymDot = document.getElementById('gym-status');
    if (gymDot) {
        (gymCheckboxState.filter(v => v).length === 2 && !gymMacrosState.penalty) 
            ? gymDot.classList.add('status-green') 
            : gymDot.classList.remove('status-green');
    }

    let gymC = 0, gymX = 0;
    gymCheckboxState.forEach(chk => { if (chk) { gymC += 10; gymX += 20; } });
    if (gymMacrosState.penalty) { gymC -= 10; gymX -= 20; }
    if (gymMacrosState.bonus) { gymC += 10; gymX += 20; }
    if (gymMacrosState.calBonus) { gymC += 10; gymX += 20; }
    lastGymCoins = gymC;
    lastGymXP = gymX;

    // 4. Вода и TikTok
    const waterText = document.getElementById('water-text');
    const waterFill = document.getElementById('water-fill');
    if (waterText) waterText.innerText = `${waterMl} / ${waterMax} мл.`;
    if (waterFill) waterFill.style.width = `${(waterMl / waterMax) * 100}%`;
    waterBonusGiven = (waterMl >= waterMax);

    const tkText = document.getElementById('tiktok-text');
    const tkFill = document.getElementById('tiktok-fill');
    if (tkText) tkText.innerText = `${tiktokMins} / ${tiktokMax} м.`;
    if (tkFill) {
        let tkRatio = Math.min(1, tiktokMins / tiktokMax);
        tkFill.style.width = `${tkRatio * 100}%`;
        if (tiktokMins > tiktokMax) tkFill.style.backgroundColor = 'var(--accent-red)';
    }

    // 5. Батареи
    const physFill = document.getElementById('fill-physical');
    const socFill = document.getElementById('fill-social');
    if (physFill) physFill.style.height = `${physicalBattery}%`;
    if (socFill) socFill.style.height = `${socialBattery}%`;
}

async function loadUserData() {
    try {
        const response = await fetch(`${API_URL}/${tgId}`);
        const data = await response.json();
        
        userCoins = data.coins || 0;
        userXP = data.xp || 0;
        userLevel = data.level || 1;
        
        const s = data.state || {};
        waterMl = s.waterMl || 0;
        tiktokMins = s.tiktokMins || 0;
        physicalBattery = s.physicalBattery !== undefined ? s.physicalBattery : 100;
        socialBattery = s.socialBattery !== undefined ? s.socialBattery : 100;
        shopDegradation = s.shopDegradation || 0;
        
        notepadTotalTasks = s.notepadTotalTasks || 0;
        notepadDoneTasks = s.notepadDoneTasks || 0;
        
        obsidianCheckboxState = s.obsidianCheckboxState || [false, false, false, false];
        gymCheckboxState = s.gymCheckboxState || [false, false];
        gymMacrosState = s.gymMacrosState || { pro: 0, carbs: 0, cal: 0, penalty: false, bonus: false, calBonus: false };

        // Перерисовываем UI без повторного отправления запроса на сервер
        updateProfileUI(false);
        syncUIStates();

    } catch (err) {
        console.error("Ошибка загрузки профиля:", err);
    }
}

// --- ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ПОСЛЕ ЗАГРУЗКИ DOM ---
document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('nav-badge-val');

    // Навигация
    const allNavLinks = document.querySelectorAll('.nav-item, .nav-profile');
    const pages = document.querySelectorAll('.page');
    const contentWrapper = document.querySelector('.content-wrapper');

    allNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            document.querySelector('.nav-profile')?.classList.remove('active');
            link.classList.add('active');

            if (badge) {
                if (link.classList.contains('nav-profile') || link.getAttribute('data-target') === 'page-shop') {
                    badge.innerText = userCoins;
                    badge.style.color = "white";  
                } else if (link.getAttribute('data-target') === 'page-tasks') {
                    badge.innerText = userLevel;
                    badge.style.color = "#0a84ff";
                }
            }

            pages.forEach(page => page.classList.remove('active'));
            const targetId = link.getAttribute('data-target');
            document.getElementById(targetId)?.classList.add('active');
            if (contentWrapper) contentWrapper.scrollTo(0, 0);
        });
    });

    // Модальные окна
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if(e.target === modal) modal.classList.remove('active');
        });
    });

    // Obsidian
    const btnEditObsidian = document.getElementById('btn-edit-obsidian');
    const modalObsidian = document.getElementById('obsidian-modal');
    const btnSaveObsidian = document.getElementById('save-obsidian-btn');

    btnEditObsidian?.addEventListener('click', () => modalObsidian?.classList.add('active'));

    btnSaveObsidian?.addEventListener('click', () => {
        const obsidianCheckboxes = document.querySelectorAll('.obsidian-check');
        let checkedCount = 0;

        obsidianCheckboxes.forEach((chk, index) => {
            if (chk.checked && !obsidianCheckboxState[index]) {
                userCoins += 10; userXP += 20;
                obsidianCheckboxState[index] = true;
            } else if (!chk.checked && obsidianCheckboxState[index]) {
                userCoins -= 10; userXP -= 20;
                obsidianCheckboxState[index] = false;
            }
            if (chk.checked) checkedCount++;
        });

        const obsidianCount = document.getElementById('obsidian-count');
        if (obsidianCount) obsidianCount.innerText = checkedCount;

        const statusDot = document.getElementById('obsidian-status');
        if (statusDot) {
            checkedCount === 4 ? statusDot.classList.add('status-green') : statusDot.classList.remove('status-green');
        }

        updateProfileUI();
        modalObsidian?.classList.remove('active');
    });

    // Notepad
    const btnEditNotepad = document.getElementById('btn-edit-notepad');
    const modalNotepad = document.getElementById('notepad-modal');
    const btnSaveNotepad = document.getElementById('save-notepad-btn');

    btnEditNotepad?.addEventListener('click', () => modalNotepad?.classList.add('active'));

    btnSaveNotepad?.addEventListener('click', () => {
        notepadTotalTasks = parseInt(document.getElementById('notepad-total')?.value) || 0;
        notepadDoneTasks = parseInt(document.getElementById('notepad-done')?.value) || 0;
        
        if (notepadDoneTasks > notepadTotalTasks) notepadDoneTasks = notepadTotalTasks; 
        
        let notDone = notepadTotalTasks - notepadDoneTasks;
        let score = notepadDoneTasks - notDone;
        let newCoins = score * 10;
        let newXP = score * 10 * 1.5;

        userCoins = userCoins - lastNotepadCoins + newCoins;
        userXP = userXP - lastNotepadXP + newXP;
        lastNotepadCoins = newCoins;
        lastNotepadXP = newXP;

        const notepadCount = document.getElementById('notepad-count');
        if (notepadCount) notepadCount.innerText = `${notepadDoneTasks}/${notepadTotalTasks}`;

        const statusDot = document.getElementById('notepad-status');
        if (statusDot) {
            (notepadTotalTasks > 0 && notepadDoneTasks === notepadTotalTasks) 
                ? statusDot.classList.add('status-green') 
                : statusDot.classList.remove('status-green');
        }
        
        updateProfileUI();
        modalNotepad?.classList.remove('active');
    });

    // Gym
    const btnEditGym = document.getElementById('btn-edit-gym');
    const modalGym = document.getElementById('gym-modal');
    const btnSaveGym = document.getElementById('save-gym-btn');

    btnEditGym?.addEventListener('click', () => modalGym?.classList.add('active'));

    btnSaveGym?.addEventListener('click', () => {
        let currentCoins = 0;
        let currentXP = 0;
        let checkedCount = 0;
        const gymCheckboxes = document.querySelectorAll('.gym-check');

        gymCheckboxes.forEach((chk, index) => {
            gymCheckboxState[index] = chk.checked;
            if (chk.checked) {
                currentCoins += 10;
                currentXP += 20;
                checkedCount++;
            }
        });

        let cal = parseInt(document.getElementById('gym-cal')?.value) || 0;
        let pro = parseInt(document.getElementById('gym-pro')?.value) || 0;
        let carbs = parseInt(document.getElementById('gym-carbs')?.value) || 0;
        
        gymMacrosState = { cal, pro, carbs, penalty: false, bonus: false, calBonus: false };

        if (carbs > pro && carbs > 0) {
            currentCoins -= 10;
            currentXP -= 20;
            gymMacrosState.penalty = true;
        } else if (pro > carbs && pro > 0) {
            currentCoins += 10;
            currentXP += 20;
            gymMacrosState.bonus = true;
        }

        if (cal >= 2000 && cal <= 2100) {
            currentCoins += 10;
            currentXP += 20;
            gymMacrosState.calBonus = true;
        }

        userCoins = userCoins - lastGymCoins + currentCoins;
        userXP = userXP - lastGymXP + currentXP;
        
        lastGymCoins = currentCoins;
        lastGymXP = currentXP;

        const gymCount = document.getElementById('gym-count');
        if (gymCount) gymCount.innerText = checkedCount;

        const statusDot = document.getElementById('gym-status');
        if (statusDot) {
            (checkedCount === 2 && !gymMacrosState.penalty) 
                ? statusDot.classList.add('status-green') 
                : statusDot.classList.remove('status-green');
        }

        updateProfileUI();
        modalGym?.classList.remove('active');
    });

    // Магазин
    document.querySelectorAll('.btn-buy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            let price = parseInt(e.target.innerText.replace(/\D/g, '')) || 0;
            if(userCoins >= price) {
                userCoins -= price;
                shopDegradation += (price / 20); 
                updateProfileUI();
                showToast("Успешно куплено!");
            } else {
                showToast("Недостаточно монет!", true);
            }
        });
    });

    // TikTok
    const tiktokCard = document.getElementById('tiktok-card');
    tiktokCard?.addEventListener('click', () => {
        tiktokMins += 5;
        const tiktokText = document.getElementById('tiktok-text');
        const tiktokFill = document.getElementById('tiktok-fill');

        if (tiktokMins <= tiktokMax) {
            if (tiktokText) tiktokText.innerText = `${tiktokMins} / ${tiktokMax} м.`;
            if (tiktokFill) tiktokFill.style.width = `${(tiktokMins / tiktokMax) * 100}%`;
            if (tiktokMins === tiktokMax) {
                showToast("Лимит TikTok достигнут!", true);
            }
        } else {
            userCoins -= 5;
            userXP -= 10;
            if (tiktokText) tiktokText.innerText = `${tiktokMins} / ${tiktokMax} м. (Штраф!)`;
            if (tiktokFill) {
                tiktokFill.style.width = `100%`;
                tiktokFill.style.backgroundColor = 'var(--accent-red)';
            }
            showToast("Превышен лимит! -5 монет, -10 XP", true);
        }
        updateProfileUI();
    });

    // Вода
    const waterCard = document.getElementById('water-card');
    waterCard?.addEventListener('click', () => {
        const waterText = document.getElementById('water-text');
        const waterFill = document.getElementById('water-fill');

        if (waterMl < waterMax) {
            waterMl += 200;
            if (waterMl > waterMax) waterMl = waterMax;
            
            if (waterText) waterText.innerText = `${waterMl} / ${waterMax} мл.`;
            if (waterFill) waterFill.style.width = `${(waterMl / waterMax) * 100}%`;
            
            if (waterMl === waterMax && !waterBonusGiven) {
                userCoins += 10;
                userXP += 25;
                waterBonusGiven = true;
                showToast("Норма выполнена! +10 монет, +25 XP", false);
            }
            updateProfileUI();
        } else {
            showToast("Хватит пить, ты лопнешь!", true);
        }
    });

    // Интерактивные батареи
    function setupBattery(barId, fillId) {
        const bar = document.getElementById(barId);
        const fill = document.getElementById(fillId);
        if (!bar || !fill) return;

        let isDragging = false;

        function updateFillLogic(e) {
            const rect = bar.getBoundingClientRect();
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            let yPos = clientY - rect.top;
            let percent = 100 - ((yPos / rect.height) * 100);
            percent = Math.max(0, Math.min(100, percent));
            
            fill.style.height = percent + '%';
            
            if (percent > 65) {
                fill.style.backgroundColor = 'var(--accent-green)';
            } else if (percent > 30) {
                fill.style.backgroundColor = 'var(--accent-yellow)';
            } else {
                fill.style.backgroundColor = 'var(--accent-red)';
            }

            if(barId === 'bar-physical') physicalBattery = percent;
            if(barId === 'bar-social') socialBattery = percent;
            
            updateCharts();
        }

        function startDrag(e) {
            isDragging = true;
            updateFillLogic(e);
        }

        function stopDrag() {
            if (isDragging) {
                isDragging = false;
                syncDataWithServer();
            }
        }

        function onDrag(e) {
            if (isDragging) {
                e.preventDefault(); 
                updateFillLogic(e);
            }
        }

        bar.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);

        bar.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);
    }

    setupBattery('bar-physical', 'fill-physical');
    setupBattery('bar-social', 'fill-social');

    // Загрузка данных при входе
    loadUserData();
});
