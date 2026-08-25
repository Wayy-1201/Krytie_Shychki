// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ TELEGRAM WEB APP
// ==========================================
const tg = window.Telegram?.WebApp || { 
    expand: () => {}, 
    // Заглушка, чтобы при открытии в браузере с ПК сайт не ломался
    initDataUnsafe: { user: { id: 123456789, username: "DevMode", first_name: "Разработчик" } } 
};
if (tg.expand) tg.expand();

const user = tg.initDataUnsafe?.user;
const tgId = user ? user.id : 123456789;

// ==========================================
// 2. ГЛОБАЛЬНЫЕ ДАННЫЕ И СОСТОЯНИЕ
// ==========================================
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

// ==========================================
// 3. БЭКЕНД И СИНХРОНИЗАЦИЯ С СЕРВЕРОМ
// ==========================================

// Установка аватарок и имени из Telegram
function setupAvatars() {
    if (!user) return;
    
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
        userNameEl.textContent = user.first_name || user.username || 'Гость';
    }

    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl && user.photo_url) {
        userAvatarEl.src = user.photo_url;
    }

    const navAvatarEl = document.getElementById('nav-avatar');
    if (navAvatarEl && user.photo_url) {
        navAvatarEl.src = user.photo_url;
    }
}

// Регистрация или обновление пользователя в БД
async function registerUser() {
    try {
        await fetch('/save_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tg_id: tgId,
                username: user?.username || user?.first_name || 'Гость'
            })
        });
    } catch (err) {
        console.error("Ошибка при регистрации:", err);
    }
}

// Отправка текущих данных в БД
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
        // Относительный путь, больше никаких http://127.0.0.1
        await fetch('/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Ошибка синхронизации:", err);
    }
}

// Загрузка данных из БД
async function loadUserData() {
    try {
        const response = await fetch(`/get_data/${tgId}`);
        if (!response.ok) {
            console.log("Данные пользователя еще не созданы или ошибка загрузки.");
            return;
        }
        
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

// ==========================================
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И UI
// ==========================================
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
    }, 4000);
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

        if(successPct > 95) {
            moralityFill.style.boxShadow = '0 0 20px rgba(50, 215, 75, 0.6)';
            moralityFill.style.backgroundColor = 'var(--accent-green)';
        } else if(successPct < 10) {
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
    
    const battarycolor = percent => {
        if (percent > 65) return 'var(--accent-green)';
        if (percent > 30) return 'var(--accent-yellow)';
        return 'var(--accent-red)';
    };

    if (physFill){
        physFill.style.height = `${physicalBattery}%`;
        physFill.style.backgroundColor = battarycolor(physicalBattery);
    };
    if (socFill){
        socFill.style.height = `${socialBattery}%`;
        socFill.style.backgroundColor = battarycolor(socialBattery);
    }

}


// ==========================================
// 5. ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ (DOM LOADED)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // Сначала устанавливаем аватарки
    setupAvatars();
    // Затем регистрируем пользователя в базе
    await registerUser();
    // Затем скачиваем его данные и перерисовываем интерфейс
    await loadUserData();

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
                const for_tree = document.querySelector('.content-wrapper');
                if (link.classList.contains('nav-profile') || link.getAttribute('data-target') === 'page-shop') {
                    badge.innerText = userCoins;
                    badge.style.color = "white";  
                    for_tree.style.marginTop = "60px"; // Возвращаем верхний маргин для дерева
                } else if (link.getAttribute('data-target') === 'page-tasks') {
                    badge.innerText = userLevel;
                    badge.style.color = "#0a84ff";
                    for_tree.style.marginTop = "60px"; // Возвращаем верхний маргин для дерева
                }
                if (link.getAttribute('data-target') === 'page-tree') {
                    if (typeof initTree === 'function') {
                        let treeStage = getTreeStage(userLevel); // Получаем текущую стадию дерева
                        initTree(); // Безопасно запускаем перерисовку и инициализацию холста
                        badge.innerHTML = treeStage; // Показываем уровень на дереве
                        badge.style.color = "#33ff00";
                        for_tree.style.padding = "0px"; // Убираем паддинг для дерева
                        for_tree.style.marginTop = "45px"; // Убираем верхний маргин для дерева
                    }
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
    initTree();

});






// ==========================================
// 6. ИНТЕРАКТИВНОЕ ДЕРЕВО (CANVAS)
// ==========================================
let treeTime = 0;
let treeCanvas = null;
let treeCtx = null;
let particles = [];
const MAX_PARTICLES = 60; // Количество летающих частиц

// Определение стадии строго по уровням
function getTreeStage(lvl) {
    if (lvl >= 1 && lvl <= 3) return 1;
    if (lvl >= 4 && lvl <= 6) return 2;
    if (lvl >= 7 && lvl <= 9) return 3;
    if (lvl >= 10 && lvl <= 14) return 4;
    if (lvl >= 15) return 5; // 19 и выше
}

// Создание одной частицы
function createParticle(w, h) {
    return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.5 - 0.5, // Летят слегка вверх
        size: Math.random() * 2 + 1.5,
        life: Math.random(),
        alpha: Math.random() * 0.5 + 0.3
    };
}

function initTree() {
    treeCanvas = document.getElementById('treeCanvas');
    const treeContainer = document.querySelector('.tree-container');

    if (!treeCanvas || !treeContainer) return;

    treeCtx = treeCanvas.getContext('2d');

    // Безопасное назначение размеров
    if (treeContainer.clientWidth > 0) {
        treeCanvas.width = treeContainer.clientWidth;
        treeCanvas.height = treeContainer.clientHeight;
    }

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                treeCanvas.width = width;
                treeCanvas.height = height;
            }
        }
    });
    
    resizeObserver.observe(treeContainer);
    
    // Запускаем цикл отрисовки один раз
    if (!window.treeAnimationStarted) {
        window.treeAnimationStarted = true;
        requestAnimationFrame(renderTree);
    }
}

function drawGround(w, h) {
    treeCtx.save();
    
    // Градиент от вершины холма до самого низа
    let groundGrad = treeCtx.createLinearGradient(0, h - 150, 0, h);
    groundGrad.addColorStop(0, '#3e5c22'); // Темно-зеленая трава на верхушке
    groundGrad.addColorStop(1, '#0a0d06'); // Плавный уход в темную почву в самом низу
    
    treeCtx.fillStyle = groundGrad;
    treeCtx.beginPath();
    
    // Начинаем отрисовку строго с левого нижнего угла
    treeCtx.moveTo(0, h); 
    // Поднимаемся вверх по левому краю холста
    treeCtx.lineTo(0, h - 60); 
    
    // Рисуем большой плавный холм. Контрольная точка изгиба по центру поднята до h - 160
    // Фактическая вершина холма получится ровно на высоте h - 110
    treeCtx.quadraticCurveTo(w / 2, h - 240, w, h - 60);
    
    // Опускаемся по правому краю и закрываем контур в правом нижнем углу
    treeCtx.lineTo(w, h); 
    treeCtx.closePath();
    treeCtx.fill();
    
    treeCtx.restore();
}

// Отрисовка магических частиц
function updateAndDrawParticles(w, h) {
    // Дозаполняем массив, если частиц не хватает
    while (particles.length < MAX_PARTICLES) {
        particles.push(createParticle(w, h));
    }

    treeCtx.save();
    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.003;

        // Если частица "умерла" или улетела за экран - пересоздаем ее внизу
        if (p.life <= 0 || p.y < 0 || p.x < 0 || p.x > w) {
            particles[i] = createParticle(w, h);
            particles[i].y = h - Math.random() * 50; 
            particles[i].life = 1;
        }

        // Мерцание
        treeCtx.globalAlpha = p.alpha * Math.abs(Math.sin(p.life * Math.PI));
        
        // Цвет светлячков (можно сделать зависимым от монет, пока просто салатово-желтые)
        treeCtx.fillStyle = '#ccff66'; 
        treeCtx.shadowBlur = 8;
        treeCtx.shadowColor = '#ccff66';
        
        treeCtx.beginPath();
        treeCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        treeCtx.fill();
    });
    treeCtx.restore();
}

function renderTree() {
    if (!treeCtx || treeCanvas.width === 0) {
        requestAnimationFrame(renderTree);
        return;
    }

    let w = treeCanvas.width;
    let h = treeCanvas.height;
    
    // Очищаем кадр
    treeCtx.clearRect(0, 0, w, h);

    let lvl = typeof userLevel !== 'undefined' ? userLevel : 1;
    let stage = getTreeStage(lvl);
    
    // 1. Рисуем фон и частицы и солнце
    drawSunAndClouds(w, h);
    drawGround(w, h);
    updateAndDrawParticles(w, h);

    let maxDepth = stage + 4; 
    let startLength = 40 + (stage * 15); 
    
    treeCtx.save();
    treeCtx.translate(w / 2, h - 110); 
    
    // 2. Добавляем магическую ауру за деревом (свечение)
    let auraGradient = treeCtx.createRadialGradient(0, -startLength * 2, 0, 0, -startLength * 2, startLength * 4);
    auraGradient.addColorStop(0, 'rgba(173, 255, 47, 0.15)'); // Легкий салатовый свет
    auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    treeCtx.fillStyle = auraGradient;
    treeCtx.beginPath();
    treeCtx.arc(0, -startLength * 2, startLength * 4, 0, Math.PI * 2);
    treeCtx.fill();
    
    // 3. Рисуем само дерево
    drawBranch(0, maxDepth, startLength, -Math.PI / 2); 
    
    treeCtx.restore();
    
    treeTime += 0.012; 
    requestAnimationFrame(renderTree);
}

function drawBranch(depth, maxDepth, length, angle) {
    if (depth >= maxDepth) return;
    
    let sway = Math.sin(treeTime + depth * 0.8) * 0.035 * (depth / maxDepth);
    let currentAngle = angle + sway;
    let endX = Math.cos(currentAngle) * length;
    let endY = Math.sin(currentAngle) * length;
    
    let thickness = Math.max(1.5, (maxDepth - depth) * 3);

    // Слой 1: Тень ствола
    treeCtx.beginPath();
    treeCtx.moveTo(0, 0);
    treeCtx.lineTo(endX, endY);
    treeCtx.lineWidth = thickness;
    treeCtx.strokeStyle = '#1e140a';
    treeCtx.lineCap = 'round';
    treeCtx.stroke();
    
    // Слой 2: Блик ствола
    if (thickness > 2) {
        treeCtx.beginPath();
        treeCtx.moveTo(0, 0);
        treeCtx.lineTo(endX * 0.95, endY * 0.95);
        treeCtx.lineWidth = thickness * 0.4;
        treeCtx.strokeStyle = '#5a3b22';
        treeCtx.stroke();
    }
    
    treeCtx.translate(endX, endY);
    
    // =======================================
    // ЦВЕТА ЛИСТЬЕВ ПО УРОВНЯМ (СТАДИЯМ)
    // =======================================
    
    if (depth === maxDepth - 1) {
        let leavesInCluster = 3; 
        
        // Получаем текущий уровень и стадию дерева
        let lvl = typeof userLevel !== 'undefined' ? userLevel : 1;
        let currentStage = getTreeStage(lvl); // 1, 2, 3, 4 или 5
        
        for (let i = 0; i < leavesInCluster; i++) {
            let rand1 = (depth * 11 + i * 17) % 100 / 100; 
            let rand2 = (depth * 13 + i * 23) % 100 / 100;
            
            let pulse = Math.sin(treeTime * 2.5 + depth + i) * 1.5;
            let leafSize = 9 + pulse + (rand1 * 5);
            let leafAngle = (rand2 - 0.5) * Math.PI * 1.2;
            
            // Базовые цвета для каждого уровня
            let r, g, b;
            
            if (currentStage === 1) {
                // 1 уровень — Коричневые / Осенние
                r = 140 + rand1 * 30;
                g = 80 + rand2 * 20;
                b = 30;
            } else if (currentStage === 2) {
                // 2 уровень — Зеленые
                r = 20 + rand1 * 40;
                g = 120 + rand2 * 80;
                b = 40 + rand1 * 30;
            } else if (currentStage === 3) {
                // 3 уровень — Синие / Голубые
                r = 30 + rand1 * 20;
                g = 100 + rand2 * 50;
                b = 200 + rand1 * 55;
            } else if (currentStage === 4) {
                // 4 уровень — Красные / Рубиновые
                r = 200 + rand1 * 55;
                g = 30 + rand2 * 20;
                b = 50 + rand1 * 20;
            } else {
                // 5 уровень — Фиолетовые / Магические
                r = 150 + rand1 * 55;
                g = 40 + rand2 * 20;
                b = 200 + rand1 * 55;
            }

            treeCtx.save();
            treeCtx.rotate(leafAngle);
            
            treeCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
            
            // Рисуем форму листа
            treeCtx.beginPath();
            treeCtx.moveTo(0, 0);
            treeCtx.quadraticCurveTo(leafSize / 2, -leafSize / 3, leafSize, 0);
            treeCtx.quadraticCurveTo(leafSize / 2, leafSize / 3, 0, 0);
            treeCtx.fill();
            
            treeCtx.restore();
        }
    }
    
    // Ветвление
    if (depth < maxDepth - 1) {
        let spread = 0.45 + (Math.sin(treeTime * 0.5) * 0.03); 
        drawBranch(depth + 1, maxDepth, length * 0.75, angle - spread);
        drawBranch(depth + 1, maxDepth, length * 0.75, angle + spread);
    }
    
    treeCtx.translate(-endX, -endY);
}


// Функция для отрисовки одного пушистого облака
function drawCloud(x, y, scale) {
    treeCtx.save();
    treeCtx.translate(x, y);
    treeCtx.scale(scale, scale);

    // Делаем облака полупрозрачными и мягкими, чтобы они вписывались в стиль
    treeCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    treeCtx.shadowBlur = 20;
    treeCtx.shadowColor = 'rgba(255, 255, 255, 0.1)';

    // Рисуем облако из пересекающихся кругов
    treeCtx.beginPath();
    treeCtx.arc(0, 0, 25, 0, Math.PI * 2);      // Левая часть
    treeCtx.arc(35, -15, 35, 0, Math.PI * 2);   // Верхушка
    treeCtx.arc(70, -5, 25, 0, Math.PI * 2);    // Правая часть
    treeCtx.arc(35, 10, 30, 0, Math.PI * 2);    // Низ (заполнитель)
    treeCtx.fill();

    treeCtx.restore();
}

// Функция для отрисовки солнца и всех облаков
function drawSunAndClouds(w, h) {
    treeCtx.save();

    // 1. Рисуем магическое теплое солнце в правом верхнем углу
    let sunX = w - 100;
    let sunY = 90;

    // Создаем красивый радиальный градиент (яркий центр, растворяющиеся края)
    let sunGrad = treeCtx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 90);
    sunGrad.addColorStop(0, 'rgba(255, 240, 180, 1)');     // Плотный светло-желтый центр
    sunGrad.addColorStop(0.3, 'rgba(255, 200, 100, 0.5)'); // Оранжевое свечение
    sunGrad.addColorStop(1, 'rgba(255, 200, 100, 0)');     // Прозрачный край

    treeCtx.fillStyle = sunGrad;
    treeCtx.beginPath();
    treeCtx.arc(sunX, sunY, 90, 0, Math.PI * 2);
    treeCtx.fill();

    // 2. Рисуем облака
    // Используем treeTime, чтобы они ооочень медленно и плавно "плыли" на месте
    let drift1 = Math.sin(treeTime * 0.05) * 20;
    let drift2 = Math.cos(treeTime * 0.04) * 15;
    let drift3 = Math.sin(treeTime * 0.06 + 2) * 25;

    // Расставляем три облака на разных высотах и разного размера
    drawCloud(w * 0.15 + drift1, 70, 0.85);  // Слева
    drawCloud(w * 0.45 + drift2, 120, 0.6);  // По центру (чуть ниже и меньше)
    drawCloud(w * 0.70 + drift3, 50, 0.9);   // Справа (ближе к солнцу)

    treeCtx.restore();
}