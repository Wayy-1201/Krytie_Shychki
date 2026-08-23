 // --- ГЛОБАЛЬНЫЕ ДАННЫЕ ПРОФИЛЯ ---
        let userCoins = 0;
        let userXP = 0;
        let userLevel = 1;

        // Данные для графиков
        let notepadTotalTasks = 0;
        let notepadDoneTasks = 0;
        let shopDegradation = 0; 
        let physicalBattery = 100;
        let socialBattery = 100;

        const profileCoinsEl = document.getElementById('profile-coins');
        const profileXpTextEl = document.getElementById('profile-xp-text');
        const profileXpBarEl = document.getElementById('profile-xp-bar');
        const profileLvlEl = document.getElementById('profile-lvl');
        const badge = document.getElementById('nav-badge-val');

        // Расчет XP для конкретного уровня (Множитель 1.5)
        function getMaxXP(lvl) {
            let xp = 200;
            for (let i = 1; i < lvl; i++) {
                xp = Math.floor(xp * 1.5);
            }
            return xp;
        }

        // --- ДИНАМИКА ГРАФИКОВ (Успех/Позор и Пирог) ---
        function updateCharts() {
            let obsDone = obsidianCheckboxState.filter(v => v).length;
            let obsNotDone = 4 - obsDone;

            let noteNotDone = Math.max(0, notepadTotalTasks - notepadDoneTasks);
            let waterRatio = waterMl / waterMax; 
            
            let tkPenaltyMins = Math.max(0, tiktokMins - tiktokMax); 
            let tkRatio = Math.min(1, tiktokMins / tiktokMax); 

            // --- ЗАЛ В ГРАФИКАХ ---
            let gymDone = gymCheckboxState.filter(v => v).length;
            let gymNotDone = 2 - gymDone;
            let gymPenalty = gymMacrosState.penalty ? 20 : 0; // Штраф бьет по позору
            let gymBonus = gymMacrosState.bonus ? 10 : 0; 
            let calBonus = gymMacrosState.calBonus ? 10 : 0;

            // ЗЕЛЕНЫЙ: Выполненные задачи, вода, полные батареи, зал
            let green = 10 
                + (obsDone * 15) 
                + (notepadDoneTasks * 15) 
                + (gymDone * 15) + gymBonus + calBonus
                + (waterRatio * 20) 
                + (physicalBattery / 100 * 15) 
                + (socialBattery / 100 * 15);

            // КРАСНЫЙ: Пропущенные задачи, магазин, перебор TikTok, штраф по углям
            let red = 10 
                + (obsNotDone * 5) 
                + (noteNotDone * 10) 
                + (gymNotDone * 5) + gymPenalty
                + (tkRatio * 10) 
                + (tkPenaltyMins * 5) 
                + shopDegradation; 

            // СИНИЙ: Низкие батареи + усталость от полезных действий
            let blue = 10
                + ((100 - physicalBattery) / 100 * 25)
                + ((100 - socialBattery) / 100 * 25)
                + (obsDone * 5)
                + (notepadDoneTasks * 5)
                + (gymDone * 5);

            // Обновление круговой диаграммы
            let totalPie = green + red + blue;
            let redPct = (red / totalPie) * 100;
            let greenPct = (green / totalPie) * 100;
            let bluePct = (blue / totalPie) * 100;

            const pieChart = document.querySelector('.pie-chart');
            pieChart.style.background = `conic-gradient(
                var(--accent-red) 0% ${redPct}%,
                var(--accent-green) ${redPct}% ${redPct + greenPct}%,
                var(--accent-blue) ${redPct + greenPct}% 100%
            )`;

            // Обновление полосы Морали (Успех vs Позор)
            let totalMorality = green + red;
            let successPct = (green / totalMorality) * 100;
            
            const moralityFill = document.querySelector('.morality-bar-fill');
            moralityFill.style.width = `${successPct}%`;

            // Динамическая подсветка полосы
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

        function updateProfileUI() {
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
            profileCoinsEl.innerText = userCoins;
            profileLvlEl.innerText = userLevel;
            profileXpTextEl.innerText = `${userXP} / ${currentMaxXP}`;
            
            let xpPercent = Math.min(100, (userXP / currentMaxXP) * 100);
            profileXpBarEl.style.width = `${xpPercent}%`;

            if (!document.querySelector('.nav-item[data-target="page-tasks"]').classList.contains('active')) {
                badge.innerText = userCoins;
            }

            updateCharts(); 
        }

        // --- УВЕДОМЛЕНИЯ ---
        const toast = document.getElementById('toast');
        let toastTimeout;

        function showToast(message, isError = false) {
            toast.innerText = message;
            if(isError) {
                toast.classList.add('error');
            } else {
                toast.classList.remove('error');
            }
            toast.classList.add('show');
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 2000);
        }

        // --- НАВИГАЦИЯ ---
        const allNavLinks = document.querySelectorAll('.nav-item, .nav-profile');
        const pages = document.querySelectorAll('.page');
        const contentWrapper = document.querySelector('.content-wrapper');

        allNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                document.querySelector('.nav-profile').classList.remove('active');
                link.classList.add('active');

                if (link.classList.contains('nav-profile') || link.getAttribute('data-target') === 'page-shop') {
                    badge.innerText = userCoins;
                    badge.style.color = "white";  
                } else if (link.getAttribute('data-target') === 'page-tasks') {
                    badge.innerText = userLevel;
                    badge.style.color = "#0a84ff";
                }

                pages.forEach(page => page.classList.remove('active'));
                const targetId = link.getAttribute('data-target');
                document.getElementById(targetId).classList.add('active');
                contentWrapper.scrollTo(0, 0);
            });
        });

        // --- ЗАДАЧИ ---
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if(e.target === modal) modal.classList.remove('active');
            });
        });

        const btnEditObsidian = document.getElementById('btn-edit-obsidian');
        const modalObsidian = document.getElementById('obsidian-modal');
        const btnSaveObsidian = document.getElementById('save-obsidian-btn');
        const obsidianCheckboxes = document.querySelectorAll('.obsidian-check');
        let obsidianCheckboxState = [false, false, false, false];

        btnEditObsidian.addEventListener('click', () => modalObsidian.classList.add('active'));

        btnSaveObsidian.addEventListener('click', () => {
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
            document.getElementById('obsidian-count').innerText = checkedCount;
            const statusDot = document.getElementById('obsidian-status');
            checkedCount === 4 ? statusDot.classList.add('status-green') : statusDot.classList.remove('status-green');
            updateProfileUI();
            modalObsidian.classList.remove('active');
        });

        const btnEditNotepad = document.getElementById('btn-edit-notepad');
        const modalNotepad = document.getElementById('notepad-modal');
        const btnSaveNotepad = document.getElementById('save-notepad-btn');
        let lastNotepadCoins = 0, lastNotepadXP = 0;

        btnEditNotepad.addEventListener('click', () => modalNotepad.classList.add('active'));

        btnSaveNotepad.addEventListener('click', () => {
            notepadTotalTasks = parseInt(document.getElementById('notepad-total').value) || 0;
            notepadDoneTasks = parseInt(document.getElementById('notepad-done').value) || 0;
            
            if (notepadDoneTasks > notepadTotalTasks) notepadDoneTasks = notepadTotalTasks; 
            
            let notDone = notepadTotalTasks - notepadDoneTasks;
            let score = notepadDoneTasks - notDone;
            let newCoins = score * 10;
            let newXP = score * 10 * 1.5;

            userCoins = userCoins - lastNotepadCoins + newCoins;
            userXP = userXP - lastNotepadXP + newXP;
            lastNotepadCoins = newCoins;
            lastNotepadXP = newXP;

            document.getElementById('notepad-count').innerText = `${notepadDoneTasks}/${notepadTotalTasks}`;
            const statusDot = document.getElementById('notepad-status');
            (notepadTotalTasks > 0 && notepadDoneTasks === notepadTotalTasks) ? statusDot.classList.add('status-green') : statusDot.classList.remove('status-green');
            
            updateProfileUI();
            modalNotepad.classList.remove('active');
        });

        // --- ЛОГИКА ЗАЛА ---
        const btnEditGym = document.getElementById('btn-edit-gym');
        const modalGym = document.getElementById('gym-modal');
        const btnSaveGym = document.getElementById('save-gym-btn');
        const gymCheckboxes = document.querySelectorAll('.gym-check');
        
        let gymCheckboxState = [false, false];
        let gymMacrosState = { pro: 0, carbs: 0, cal: 0, penalty: false, bonus: false, calBonus: false };
        let lastGymCoins = 0;
        let lastGymXP = 0;

        btnEditGym.addEventListener('click', () => modalGym.classList.add('active'));

        btnSaveGym.addEventListener('click', () => {
            let currentCoins = 0;
            let currentXP = 0;
            let checkedCount = 0;

            // Чекбоксы (каждый по 10 монет / 20 XP)
            gymCheckboxes.forEach((chk, index) => {
                gymCheckboxState[index] = chk.checked;
                if (chk.checked) {
                    currentCoins += 10;
                    currentXP += 20;
                    checkedCount++;
                }
            });

            // Инпуты (КБЖУ)
            let cal = parseInt(document.getElementById('gym-cal').value) || 0;
            let pro = parseInt(document.getElementById('gym-pro').value) || 0;
            let carbs = parseInt(document.getElementById('gym-carbs').value) || 0;
            
            gymMacrosState = { cal, pro, carbs, penalty: false, bonus: false, calBonus: false };

            // Условие штрафа: углеводов больше чем белков
            if (carbs > pro && carbs > 0) {
                currentCoins -= 10;
                currentXP -= 20;
                gymMacrosState.penalty = true;
            } else if (pro > carbs && pro > 0) {
                // Бонус за преобладание белка над углеводами
                currentCoins += 10;
                currentXP += 20;
                gymMacrosState.bonus = true;
            }

            // Бонус за норму калорий (2000-2100)
            if (cal >= 2000 && cal <= 2100) {
                currentCoins += 10;
                currentXP += 20;
                gymMacrosState.calBonus = true;
            }

            // Начисляем разницу
            userCoins = userCoins - lastGymCoins + currentCoins;
            userXP = userXP - lastGymXP + currentXP;
            
            lastGymCoins = currentCoins;
            lastGymXP = currentXP;

            // Обновляем текст на карточке
            document.getElementById('gym-count').innerText = checkedCount;
            const statusDot = document.getElementById('gym-status');
            
            // Зеленая точка, если обе галочки стоят и нет штрафа по углям
            if (checkedCount === 2 && !gymMacrosState.penalty) {
                statusDot.classList.add('status-green');
            } else {
                statusDot.classList.remove('status-green');
            }

            updateProfileUI();
            modalGym.classList.remove('active');
        });

        // Магазин
        document.querySelectorAll('.btn-buy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                let price = parseInt(e.target.innerText.replace(/\D/g, ''));
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

        // --- ЛОГИКА TIKTOK (Профиль) ---
        let tiktokMins = 0;
        const tiktokMax = 45;
        const tiktokCard = document.getElementById('tiktok-card');
        const tiktokFill = document.getElementById('tiktok-fill');
        const tiktokText = document.getElementById('tiktok-text');

        tiktokCard.addEventListener('click', () => {
            tiktokMins += 5;
            
            if (tiktokMins <= tiktokMax) {
                tiktokText.innerText = `${tiktokMins} / ${tiktokMax} м.`;
                tiktokFill.style.width = `${(tiktokMins / tiktokMax) * 100}%`;
                if (tiktokMins === tiktokMax) {
                    showToast("Лимит TikTok достигнут!", true);
                }
            } else {
                userCoins -= 5;
                userXP -= 10;
                
                tiktokText.innerText = `${tiktokMins} / ${tiktokMax} м. (Штраф!)`;
                tiktokFill.style.width = `100%`;
                tiktokFill.style.backgroundColor = 'var(--accent-red)';
                
                showToast("Превышен лимит! -5 монет, -10 XP", true);
            }
            updateProfileUI();
        });

        // --- ЛОГИКА ВОДЫ (Профиль) ---
        let waterMl = 0;
        const waterMax = 2500;
        let waterBonusGiven = false;
        const waterCard = document.getElementById('water-card');
        const waterFill = document.getElementById('water-fill');
        const waterText = document.getElementById('water-text');

        waterCard.addEventListener('click', () => {
            if (waterMl < waterMax) {
                waterMl += 200;
                if (waterMl > waterMax) waterMl = waterMax;
                
                waterText.innerText = `${waterMl} / ${waterMax} мл.`;
                waterFill.style.width = `${(waterMl / waterMax) * 100}%`;
                
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

        // --- ИНТЕРАКТИВНЫЕ БАТАРЕИ (Физическая / Социальная) ---
        function setupBattery(barId, fillId) {
            const bar = document.getElementById(barId);
            const fill = document.getElementById(fillId);
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
                isDragging = false;
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

        // Инициализация графиков при старте
        updateCharts();
        document.addEventListener('DOMContentLoaded', function(){
            badge.innerText = userLevel;
        });
