'use strict';

let currentTab = 'fgSummary';
window.selectedCases = new Map();

// Настройки видимых столбцов (по умолчанию)
const defaultColumnSettings = {
  fgSummary: {
    'ФГ': true,
    'Кассы': true,
    'Деп. $': true,
    'Преп. $': true,
    'Игроки': true,
    'Выв. $': true,
    'Профит ($)': true,
    'Ввод/вывод %': true,
    'Деп/преп %': true,
    'Комиссия $': true,
    'Ср. деп. $': true,
    'Ср. выв.($)': true,
    'Кол-во касс': true
  },
  calculation: {
    'Номер игрока': true,
    'Игрок': true,
    'Сумма пополнений': true,
    'Сумма вывода': true,
    'Сумма пополнений (в валюте админа по курсу текущего дня)': true,
    'Сумма вывода (в валюте админа по курсу текущего дня)': true,
    'Количество пополнений': true,
    'Количество выводов': true,
    'Касса': true,
    'Комиссия': true,
    'Средний депозит': true,
    'Средний вывод': true,
    'Профит': true,
    'Похожие имена': true,
    // Скрытые по умолчанию
    'Комиссия агента': false,
    'Махинации с платежами': false,
    'Махинации с платежами (в валюте админа по курсу текущего дня)': false,
    'Комиссия агента (в валюте админа по курсу текущего дня)': false
  }
};

// Загрузка настроек из sessionStorage
function loadColumnSettings(type) {
  const saved = sessionStorage.getItem(`columnSettings_${type}`);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Мержим с дефолтными настройками чтобы новые столбцы появлялись
      return { ...defaultColumnSettings[type], ...parsed };
    } catch (e) {
      console.error('[Results] Ошибка парсинга настроек столбцов:', e);
    }
  }
  return { ...defaultColumnSettings[type] };
}

// Сохранение настроек в sessionStorage
function saveColumnSettings(type, settings) {
  sessionStorage.setItem(`columnSettings_${type}`, JSON.stringify(settings));
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadResults();
});

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  currentTab = tab;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tab);
  });
}

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CashierCheckupDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('results')) {
        db.createObjectStore('results');
      }
    };
  });
}

async function loadFromIndexedDB() {
  try {
    const db = await openDB();
    const tx = db.transaction('results', 'readonly');
    const store = tx.objectStore('results');
    
    const fgSummary = await new Promise((resolve, reject) => {
      const req = store.get('fgSummary');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    const grouped = await new Promise((resolve, reject) => {
      const req = store.get('grouped');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    const fraudAnalysis = await new Promise((resolve, reject) => {
      const req = store.get('fraudAnalysis');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    const config = await new Promise((resolve, reject) => {
      const req = store.get('config');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    const timestamp = await new Promise((resolve, reject) => {
      const req = store.get('timestamp');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    return {
      fgSummary,
      grouped,
      fraudAnalysis,
      config,
      timestamp
    };
  } catch (error) {
    console.error('[Results] Ошибка загрузки из IndexedDB:', error);
    return null;
  }
}

async function loadResults() {
  let data = await loadFromIndexedDB();
  
  if (!data || !data.fgSummary) {
    const localStorageData = localStorage.getItem('cashierCheckupResults');
    if (localStorageData) {
      try {
        data = JSON.parse(localStorageData);
      } catch (e) {
        console.error('[Results] Ошибка парсинга localStorage:', e);
      }
    }
  }
  
  if (!data || !data.fgSummary) {
    window.location.href = 'index.html';
    return;
  }
  
  window.cashierCheckupResults = data;
  window.allFraudCases = data.fraudAnalysis || [];
  window.filteredFraudCases = [...window.allFraudCases];
  
  console.log('[Results] Загружено:', {
    processed: data.processed?.length,
    grouped: data.grouped?.length,
    fraud: data.fraudAnalysis?.length,
    fgSummary: data.fgSummary?.length
  });
  
  // Сводка ФГ
  if (data.fgSummary && data.fgSummary.length > 0) {
    renderFGSummaryTable(data.fgSummary, 'fgSummaryTable');
  }
  
  // ВИРТУАЛИЗИРОВАННАЯ калькуляция
  if (data.grouped && data.grouped.length > 0) {
    console.log('[Results] Рендеринг калькуляции, строк:', data.grouped.length);
    renderCalculationTableVirtualized(data.grouped, 'processedTable');
  }
  
  if (data.fraudAnalysis && data.fraudAnalysis.length > 0) {
    applyFraudFilters();
  }
}

// Модальное окно для выбора столбцов
function openColumnModal(type) {
  const modalId = `columnModal_${type}`;
  let modal = document.getElementById(modalId);
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'column-modal';
    modal.innerHTML = `
      <div class="column-modal-content">
        <div class="column-modal-header">
          <h3>Выбор столбцов</h3>
          <button class="column-modal-close" onclick="closeColumnModal('${type}')">&times;</button>
        </div>
        <div class="column-modal-body" id="${modalId}_body"></div>
        <div class="column-modal-footer">
          <button class="btn-secondary" onclick="resetColumnSettings('${type}')">Сбросить</button>
          <button class="btn-export" onclick="applyColumnSettings('${type}')">Применить</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  const settings = loadColumnSettings(type);
  const body = document.getElementById(`${modalId}_body`);
  body.innerHTML = '';
  
  Object.keys(settings).forEach(column => {
    const label = document.createElement('label');
    label.className = 'column-checkbox';
    label.innerHTML = `
      <input type="checkbox" value="${column}" ${settings[column] ? 'checked' : ''}>
      <span>${column}</span>
    `;
    body.appendChild(label);
  });
  
  modal.style.display = 'flex';
}

function closeColumnModal(type) {
  const modal = document.getElementById(`columnModal_${type}`);
  if (modal) {
    modal.style.display = 'none';
  }
}

function resetColumnSettings(type) {
  saveColumnSettings(type, { ...defaultColumnSettings[type] });
  closeColumnModal(type);
  applyColumnSettings(type);
}

function applyColumnSettings(type) {
  const modalId = `columnModal_${type}`;
  const body = document.getElementById(`${modalId}_body`);
  const checkboxes = body.querySelectorAll('input[type="checkbox"]');
  
  const settings = {};
  checkboxes.forEach(cb => {
    settings[cb.value] = cb.checked;
  });
  
  saveColumnSettings(type, settings);
  closeColumnModal(type);
  
  // Перерендерить таблицу
  if (type === 'fgSummary') {
    renderFGSummaryTable(window.cashierCheckupResults.fgSummary, 'fgSummaryTable');
  } else if (type === 'calculation') {
    renderCalculationTableVirtualized(window.cashierCheckupResults.grouped, 'processedTable');
  }
}

// ВИРТУАЛИЗИРОВАННЫЙ рендеринг калькуляции
function renderCalculationTableVirtualized(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">Нет данных для отображения</div>
      </div>
    `;
    return;
  }
  
  // Добавляем поле поиска
  const searchContainer = document.createElement('div');
  searchContainer.className = 'player-search-container';
  searchContainer.innerHTML = `
    <input type="text" id="playerSearchInput" placeholder="🔍 Поиск по номеру игрока..." class="player-search-input">
    <span id="playerSearchResults" class="player-search-results">Всего записей: ${data.filter(r => !r._separator && !r._isFG && !r._isOverall).length}</span>
  `;
  container.appendChild(searchContainer);
  
  const CHUNK_SIZE = 100;
  let currentChunk = 0;
  let isLoading = false;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  wrapper.style.maxHeight = '70vh';
  wrapper.style.overflowY = 'auto';
  
  const table = document.createElement('table');
  table.className = 'data-table';
  table.id = 'calculationTable';
  
  const firstDataRow = data.find(r => !r._separator);
  if (!firstDataRow) {
    container.innerHTML = '<div>Нет данных</div>';
    return;
  }
  
  const allHeaders = Object.keys(firstDataRow).filter(h => !h.startsWith('_'));
  const columnSettings = loadColumnSettings('calculation');
  
  // Фильтруем заголовки по настройкам
  const headers = allHeaders.filter(h => columnSettings[h] !== false);
  
  const thead = table.createTHead();
  thead.style.position = 'sticky';
  thead.style.top = '0';
  thead.style.zIndex = '10';
  thead.style.backgroundColor = 'white';
  
  const headerRow = thead.insertRow();
  
  headers.forEach((header, index) => {
    const th = document.createElement('th');
    th.textContent = header;
    th.dataset.column = index;
    headerRow.appendChild(th);
  });
  
  const tbody = table.createTBody();
  
  function renderChunk(startIndex) {
    const endIndex = Math.min(startIndex + CHUNK_SIZE, data.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      const row = data[i];
      const tr = tbody.insertRow();
      tr.dataset.rowIndex = i;
      
      if (row._separator) {
        tr.className = 'separator-row';
        const td = tr.insertCell();
        td.colSpan = headers.length;
        td.textContent = row._cashier || '';
      } else {
        if (row._isFG) tr.className = 'fg-row';
        if (row._isOverall) tr.className = 'overall-row';
        
        // Сохраняем номер игрока для поиска
        const playerIdKey = allHeaders.find(h => h.includes('игрока') || h.includes('Номер'));
        if (playerIdKey) {
          tr.dataset.playerId = row[playerIdKey] || '';
        }
        
        // Сохраняем похожие имена для поиска
        if (row['Похожие имена']) {
          tr.dataset.similarNames = row['Похожие имена'];
        }
        
        headers.forEach(header => {
          const td = tr.insertCell();
          let value = row[header];
          
          // Обработка "Похожие имена" с сокращением
          if (header === 'Похожие имена' && value) {
            const fullValue = value;
            const parts = String(value).split(', ');
            
            if (parts.length > 3) {
              const preview = parts.slice(0, 3).join(', ');
              const remaining = parts.length - 3;
              td.innerHTML = `${preview} <span class="truncated-hint" title="${fullValue}">...и ещё ${remaining}</span>`;
              td.dataset.fullValue = fullValue;
            } else {
              td.textContent = value;
            }
          } else if (typeof value === 'number') {
            td.textContent = formatNumber(value);
            if (header.includes('Профит') || header.includes('профит')) {
              td.className = value >= 0 ? 'num-positive' : 'num-negative';
            }
          } else {
            td.textContent = value || '';
          }
        });
      }
    }
  }
  
  renderChunk(0);
  currentChunk = 1;
  
  wrapper.addEventListener('scroll', () => {
    if (isLoading) return;
    
    const scrollTop = wrapper.scrollTop;
    const scrollHeight = wrapper.scrollHeight;
    const clientHeight = wrapper.clientHeight;
    
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      const startIndex = currentChunk * CHUNK_SIZE;
      
      if (startIndex < data.length) {
        isLoading = true;
        
        setTimeout(() => {
          renderChunk(startIndex);
          currentChunk++;
          isLoading = false;
        }, 50);
      }
    }
  });
  
  wrapper.appendChild(table);
  container.appendChild(wrapper);
  
  // Добавляем обработчик поиска с debounce
  const searchInput = document.getElementById('playerSearchInput');
  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterPlayerRows(e.target.value.trim());
    }, 300);
  });
  
  console.log('[Results] Калькуляция: первый чанк отрендерен, всего строк:', data.length);
}

// Фильтрация строк по номеру игрока - ПОКАЗЫВАТЬ ТОЛЬКО СОВПАДЕНИЯ
function filterPlayerRows(searchTerm) {
  const table = document.getElementById('calculationTable');
  if (!table) return;
  
  const tbody = table.querySelector('tbody');
  const rows = tbody.querySelectorAll('tr');
  
  if (!searchTerm) {
    // Показать все строки
    rows.forEach(row => {
      row.style.display = '';
    });
    
    const totalRows = Array.from(rows).filter(r => 
      !r.classList.contains('separator-row') && 
      !r.classList.contains('fg-row') && 
      !r.classList.contains('overall-row')
    ).length;
    
    document.getElementById('playerSearchResults').textContent = `Всего записей: ${totalRows}`;
    return;
  }
  
  const searchLower = searchTerm.toLowerCase();
  let foundCount = 0;
  let lastVisibleSeparator = null;
  
  rows.forEach(row => {
    // Сепараторы скрываем по умолчанию, покажем только если есть совпадения в секции
    if (row.classList.contains('separator-row')) {
      row.style.display = 'none';
      lastVisibleSeparator = row;
      return;
    }
    
    // ФГ и Итого всегда скрываем при поиске
    if (row.classList.contains('fg-row') || row.classList.contains('overall-row')) {
      row.style.display = 'none';
      return;
    }
    
    const playerId = (row.dataset.playerId || '').toLowerCase();
    const similarNames = (row.dataset.similarNames || '').toLowerCase();
    
    if (playerId.includes(searchLower) || similarNames.includes(searchLower)) {
      row.style.display = '';
      foundCount++;
      
      // Показываем сепаратор секции если есть совпадение
      if (lastVisibleSeparator) {
        lastVisibleSeparator.style.display = '';
      }
    } else {
      row.style.display = 'none';
    }
  });
  
  document.getElementById('playerSearchResults').textContent = `Найдено: ${foundCount} записей`;
}

function renderFGSummaryTable(data, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  table.innerHTML = '';
  
  const columnSettings = loadColumnSettings('fgSummary');
  const allHeaders = Object.keys(data[0]).filter(key => !key.startsWith('_') && key !== 'Export');
  const headers = allHeaders.filter(h => columnSettings[h] !== false);
  
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  headers.forEach((header, index) => {
    const th = document.createElement('th');
    th.textContent = header;
    th.dataset.column = index;
    th.addEventListener('click', () => sortTable(table, index));
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  data.forEach(row => {
    const tr = document.createElement('tr');
    
    headers.forEach(header => {
      const td = document.createElement('td');
      let value = row[header];
      
      // ИСПРАВЛЕНИЕ: Сокращаем список касс корректно
      if (header === 'Кассы' && typeof value === 'string') {
        const cashiers = value.split(', ');
        const uniqueCashiers = [];
        const seenIds = new Set();
        
        // Убираем дубликаты по ID кассы
        cashiers.forEach(cashier => {
          const match = cashier.match(/^(\d+)/);
          const id = match ? match[1] : cashier;
          
          if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueCashiers.push(cashier);
          }
        });
        
        if (uniqueCashiers.length > 1) {
          const preview = uniqueCashiers[0];
          const remaining = uniqueCashiers.length - 1;
          td.innerHTML = `${preview} <span class="truncated-hint" title="${uniqueCashiers.join(', ')}">...и ещё ${remaining}</span>`;
          td.dataset.fullValue = uniqueCashiers.join(', ');
        } else {
          td.textContent = uniqueCashiers[0] || value;
        }
      } else if (typeof value === 'number') {
        td.textContent = formatNumber(value);
        td.className = value >= 0 ? 'num-positive' : 'num-negative';
      } else {
        td.textContent = value || '';
      }
      
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
}

function sortTable(table, columnIndex) {
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  
  const currentDir = table.dataset.sortDir || 'desc';
  const newDir = currentDir === 'desc' ? 'asc' : 'desc';
  table.dataset.sortDir = newDir;
  
  rows.sort((a, b) => {
    if (a.classList.contains('separator-row')) return -1;
    if (b.classList.contains('separator-row')) return 1;
    
    const aText = a.cells[columnIndex].textContent.trim();
    const bText = b.cells[columnIndex].textContent.trim();
    
    const aNum = parseFloat(aText.replace(/[^\d.-]/g, ''));
    const bNum = parseFloat(bText.replace(/[^\d.-]/g, ''));
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return newDir === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    return newDir === 'asc' ?
      aText.localeCompare(bText, 'ru') :
      bText.localeCompare(aText, 'ru');
  });
  
  rows.forEach(row => tbody.appendChild(row));
}

function toggleSelectAll() {
  window.selectedCases.clear();
  document.querySelectorAll('.fraud-case-checkbox').forEach(cb => {
    const fraudCase = cb.closest('.fraud-case');
    if (fraudCase && fraudCase.style.display !== 'none') {
      cb.checked = true;
      const index = parseInt(cb.dataset.caseIndex);
      window.selectedCases.set(index, true);
    }
  });
  console.log('[Results] toggleSelectAll: выбрано индексов', window.selectedCases.size);
  updateSelectedCount();
}

function toggleSelectNone() {
  window.selectedCases.clear();
  document.querySelectorAll('.fraud-case-checkbox').forEach(cb => {
    cb.checked = false;
  });
  console.log('[Results] toggleSelectNone');
  updateSelectedCount();
}

function updateSelectedCount() {
  const visibleCheckboxes = Array.from(document.querySelectorAll('.fraud-case-checkbox'))
    .filter(cb => {
      const fraudCase = cb.closest('.fraud-case');
      return fraudCase && fraudCase.style.display !== 'none';
    });
  const total = visibleCheckboxes.length;
  document.getElementById('selectedCount').textContent = `Выбрано: ${window.selectedCases.size} из ${total}`;
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
  
  const filterHigh = document.getElementById('filterHigh')?.checked ?? true;
  const filterMedium = document.getElementById('filterMedium')?.checked ?? true;
  const filterLow = document.getElementById('filterLow')?.checked ?? true;
  
  const filterTypes = {
    'HIGH_WITHDRAWALS': document.getElementById('filterHighWithdrawals')?.checked ?? true,
    'HIGH_BALANCED_FLOW': document.getElementById('filterHighBalancedFlow')?.checked ?? true,
    'AGENT_SELF_PLAY': document.getElementById('filterAgentSelfPlay')?.checked ?? true,
    'EMPTY_ACCOUNTS': document.getElementById('filterEmptyAccounts')?.checked ?? true,
    'TRASH_ACCOUNTS': document.getElementById('filterTrashAccounts')?.checked ?? false,
    'MULTI_ACCOUNTS': document.getElementById('filterMultiAccounts')?.checked ?? true,
    'AGENT_TAKEOVER': document.getElementById('filterAgentTakeover')?.checked ?? true
  };
  
  const filtered = allCases.filter(c => {
    const severityMatch = 
      (filterHigh && c.severity === 'HIGH') ||
      (filterMedium && c.severity === 'MEDIUM') ||
      (filterLow && c.severity === 'LOW');
    
    if (!severityMatch) return false;
    return filterTypes[c.type] !== false;
  });
  
  window.filteredFraudCases = filtered;
  
  document.getElementById('fraudStatsTotal').textContent = `Всего: ${allCases.length}`;
  document.getElementById('fraudStatsShown').textContent = `Показано: ${filtered.length}`;
  
  const groupByAgent = document.getElementById('groupByAgent')?.checked ?? true;
  
  if (groupByAgent) {
    renderFraudGroupedBySeverity(filtered, 'fraudContent');
  } else {
    renderFraudFlat(filtered, 'fraudContent');
  }
  
  updateSelectedCount();
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
  
  const sorted = [...cases].sort((a, b) => {
    const order = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
    return order[a.severity] - order[b.severity];
  });
  
  sorted.forEach((fraudCase, index) => {
    const div = createFraudCaseElement(fraudCase, index);
    container.appendChild(div);
  });
}

function renderFraudGroupedBySeverity(cases, containerId) {
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
  
  const grouped = { HIGH: {}, MEDIUM: {}, LOW: {} };
  
  cases.forEach(c => {
    const severity = c.severity;
    const agent = c.agentName || 'Неизвестный агент';
    
    if (!grouped[severity][agent]) {
      grouped[severity][agent] = {};
    }
    
    c.cashiers.forEach(cashierName => {
      const cashierId = extractCashierIdFromName(cashierName);
      
      if (!grouped[severity][agent][cashierId]) {
        grouped[severity][agent][cashierId] = {
          name: cashierName,
          players: []
        };
      }
      
      const existingPlayer = grouped[severity][agent][cashierId].players.find(p => 
        p.playerId === c.playerId && p.type === c.type
      );
      
      if (!existingPlayer) {
        grouped[severity][agent][cashierId].players.push(c);
      }
    });
  });
  
  let globalIndex = 0;
  
  ['HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
    const agents = grouped[severity];
    const agentNames = Object.keys(agents);
    
    if (agentNames.length === 0) return;
    
    const severityHeader = document.createElement('h2');
    const totalCases = agentNames.reduce((sum, agent) => {
      return sum + Object.values(agents[agent]).reduce((s, c) => s + c.players.length, 0);
    }, 0);
    severityHeader.textContent = `${severity} (${totalCases})`;
    severityHeader.style.marginTop = '40px';
    severityHeader.style.marginBottom = '20px';
    severityHeader.style.color = severity === 'HIGH' ? '#c62828' : severity === 'MEDIUM' ? '#ef6c00' : '#2e7d32';
    container.appendChild(severityHeader);
    
    agentNames.sort().forEach(agent => {
      const cashiers = agents[agent];
      const agentTotalCases = Object.values(cashiers).reduce((sum, c) => sum + c.players.length, 0);
      
      const agentHeader = document.createElement('h3');
      agentHeader.textContent = `${agent} (${agentTotalCases})`;
      agentHeader.style.marginBottom = '12px';
      agentHeader.style.color = '#667eea';
      agentHeader.style.fontSize = '18px';
      container.appendChild(agentHeader);
      
      Object.keys(cashiers).sort().forEach(cashierId => {
        const cashierData = cashiers[cashierId];
        
        const cashierHeader = document.createElement('h4');
        cashierHeader.className = 'cashier-header';
        cashierHeader.textContent = `Касса ${cashierId} (${cashierData.players.length})`;
        container.appendChild(cashierHeader);
        
        const sortedPlayers = cashierData.players.sort((a, b) => {
          const typeOrder = {
            'HIGH_WITHDRAWALS': 0,
            'HIGH_BALANCED_FLOW': 1,
            'AGENT_TAKEOVER': 2,
            'AGENT_SELF_PLAY': 3,
            'MULTI_ACCOUNTS': 4,
            'EMPTY_ACCOUNTS': 5,
            'TRASH_ACCOUNTS': 6
          };
          return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        });
        
        sortedPlayers.forEach(fraudCase => {
          const div = createFraudCaseElement(fraudCase, globalIndex);
          div.classList.add('nested');
          container.appendChild(div);
          globalIndex++;
        });
      });
      
      const separator = document.createElement('div');
      separator.className = 'agent-separator';
      container.appendChild(separator);
    });
  });
  
  console.log('[Results] Фрод-анализ отрендерен, всего кейсов:', globalIndex);
}

function createFraudCaseElement(fraudCase, index) {
  const div = document.createElement('div');
  div.className = `fraud-case severity-${fraudCase.severity.toLowerCase()}`;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'fraud-case-checkbox';
  checkbox.dataset.caseIndex = index;
  checkbox.checked = window.selectedCases.has(index);
  checkbox.style.marginRight = '12px';
  checkbox.style.cursor = 'pointer';
  checkbox.onchange = (e) => {
    if (e.target.checked) {
      window.selectedCases.set(index, true);
      console.log('[Checkbox] Добавлен индекс:', index);
    } else {
      window.selectedCases.delete(index);
      console.log('[Checkbox] Удален индекс:', index);
    }
    console.log('[Checkbox] Текущие индексы:', Array.from(window.selectedCases.keys()));
    updateSelectedCount();
  };
  
  const contentDiv = document.createElement('div');
  contentDiv.style.flex = '1';
  
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
  
  contentDiv.innerHTML = html;
  
  div.style.display = 'flex';
  div.style.alignItems = 'flex-start';
  div.appendChild(checkbox);
  div.appendChild(contentDiv);
  
  return div;
}

function extractCashierIdFromName(cashierName) {
  const match = String(cashierName).match(/^(\d+)[,\s]/);
  return match ? match[1] : cashierName;
}

function getTypeTitle(type) {
  const titles = {
    'HIGH_WITHDRAWALS': 'Высокие выводы',
    'HIGH_BALANCED_FLOW': 'Крупные близкие вводы-выводы',
    'AGENT_SELF_PLAY': 'Агент играет',
    'EMPTY_ACCOUNTS': 'Пустые аккаунты',
    'TRASH_ACCOUNTS': 'Мусорные имена',
    'MULTI_ACCOUNTS': 'Мультиаккаунты',
    'AGENT_TAKEOVER': 'Концентрация выводов'
  };
  return titles[type] || type;
}

function formatNumber(num) {
  if (isNaN(num)) return num;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}
