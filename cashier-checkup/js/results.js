'use strict';

// Загружаем результаты из sessionStorage
let cashierCheckupResults = null;

document.addEventListener('DOMContentLoaded', () => {
  loadResults();
  initTabs();
  renderAllTabs();
});

function loadResults() {
  const stored = sessionStorage.getItem('cashierCheckupResults');
  
  if (!stored) {
    alert('Нет данных. Вернитесь на главную страницу.');
    window.location.href = 'index.html';
    return;
  }
  
  try {
    cashierCheckupResults = JSON.parse(stored);
    window.cashierCheckupResults = cashierCheckupResults; // Для export.js
    console.log('[Results] Загружены результаты:', cashierCheckupResults);
  } catch (error) {
    alert('Ошибка загрузки результатов: ' + error.message);
    window.location.href = 'index.html';
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  // Убираем активный класс со всех кнопок и контента
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Активируем выбранную вкладку
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

function renderAllTabs() {
  const results = cashierCheckupResults;
  
  // 1. Калькуляция (сгруппированные данные)
  if (results.grouped && results.grouped.length > 0) {
    renderTable(results.grouped, 'processedTable');
  }
  
  // 2. Сводка ФГ
  if (results.fgSummary && results.fgSummary.length > 0) {
    renderTable(results.fgSummary, 'fgSummaryTable');
  } else {
    document.getElementById('fgSummaryTable').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">Сводка не создана или нет данных ФГ</div>
      </div>
    `;
  }
  
  // 3. Фрод-анализ
  window.allFraudCases = results.fraudAnalysis || [];
  window.filteredFraudCases = [...window.allFraudCases];
  applyFraudFilters();
}

function applyFraudFilters() {
  const allCases = window.allFraudCases || [];
  
  if (allCases.length === 0) {
    document.getElementById('fraudContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">Подозрительных случаев не найдено</div>
      </div>
    `;
    return;
  }
  
  // Фильтры severity
  const filterHigh = document.getElementById('filterHigh')?.checked ?? true;
  const filterMedium = document.getElementById('filterMedium')?.checked ?? true;
  const filterLow = document.getElementById('filterLow')?.checked ?? true;
  
  // Фильтры типов
  const filterTypes = {
    'HIGH_WITHDRAWALS': document.getElementById('filterHighWithdrawals')?.checked ?? true,
    'AGENT_SELF_PLAY': document.getElementById('filterAgentSelfPlay')?.checked ?? true,
    'EMPTY_ACCOUNTS': document.getElementById('filterEmptyAccounts')?.checked ?? true,
    'TRASH_ACCOUNTS': document.getElementById('filterTrashAccounts')?.checked ?? true,
    'MULTI_ACCOUNTS': document.getElementById('filterMultiAccounts')?.checked ?? true
  };
  
  // Применяем фильтры
  const filtered = allCases.filter(c => {
    const severityMatch = 
      (filterHigh && c.severity === 'HIGH') ||
      (filterMedium && c.severity === 'MEDIUM') ||
      (filterLow && c.severity === 'LOW');
    
    if (!severityMatch) return false;
    return filterTypes[c.type] !== false;
  });
  
  window.filteredFraudCases = filtered;
  
  // Обновляем статистику
  document.getElementById('fraudStatsTotal').textContent = `Всего: ${allCases.length}`;
  document.getElementById('fraudStatsShown').textContent = `Показано: ${filtered.length}`;
  
  // Группировка
  const groupByAgent = document.getElementById('groupByAgent')?.checked ?? true;
  
  if (groupByAgent) {
    renderFraudGrouped(filtered, 'fraudContent');
  } else {
    renderFraudFlat(filtered, 'fraudContent');
  }
}

function renderFraudFlat(cases, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (cases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">Нет результатов по выбранным фильтрам</div>
      </div>
    `;
    return;
  }
  
  // Сортируем по severity
  const sorted = [...cases].sort((a, b) => {
    const order = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
    return order[a.severity] - order[b.severity];
  });
  
  sorted.forEach(fraudCase => {
    const div = createFraudCaseElement(fraudCase);
    container.appendChild(div);
  });
}

function renderFraudGrouped(cases, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (cases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">Нет результатов по выбранным фильтрам</div>
      </div>
    `;
    return;
  }
  
  // Группируем по агентам
  const grouped = {};
  cases.forEach(c => {
    const agent = c.agentName || 'Неизвестный агент';
    if (!grouped[agent]) grouped[agent] = [];
    grouped[agent].push(c);
  });
  
  Object.keys(grouped).sort().forEach(agent => {
    const agentSection = document.createElement('div');
    agentSection.style.marginBottom = '30px';
    
    const agentHeader = document.createElement('h3');
    agentHeader.textContent = agent;
    agentHeader.style.marginBottom = '12px';
    agentHeader.style.color = '#667eea';
    agentSection.appendChild(agentHeader);
    
    // Сортируем внутри группы
    grouped[agent].sort((a, b) => {
      const order = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
      return order[a.severity] - order[b.severity];
    }).forEach(fraudCase => {
      const div = createFraudCaseElement(fraudCase);
      agentSection.appendChild(div);
    });
    
    container.appendChild(agentSection);
  });
}

function createFraudCaseElement(fraudCase) {
  const div = document.createElement('div');
  div.className = `fraud-case severity-${fraudCase.severity.toLowerCase()}`;
  
  let html = `
    <div class="fraud-case-header">
      <div class="fraud-case-title">${getTypeTitle(fraudCase.type)}</div>
      <div class="severity-badge ${fraudCase.severity.toLowerCase()}">${fraudCase.severity}</div>
    </div>
    <div class="fraud-case-details">
      <strong>Кассы:</strong> ${fraudCase.cashiers.join(', ')}<br>
  `;
  
  if (fraudCase.playerId) {
    html += `<strong>Игрок:</strong> ${fraudCase.playerId}`;
    if (fraudCase.playerName) {
      html += ` (${fraudCase.playerName})`;
    }
    html += '<br>';
  }
  
  html += `<strong>Детали:</strong> ${fraudCase.details}`;
  html += '</div>';
  
  div.innerHTML = html;
  return div;
}

function getTypeTitle(type) {
  const titles = {
    'HIGH_WITHDRAWALS': 'Высокие выводы',
    'AGENT_SELF_PLAY': 'Агент играет',
    'EMPTY_ACCOUNTS': 'Пустые аккаунты',
    'TRASH_ACCOUNTS': 'Мусорные имена',
    'MULTI_ACCOUNTS': 'Мультиаккаунты'
  };
  return titles[type] || type;
}
