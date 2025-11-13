'use strict';

let currentTab = 'fgSummary';
let selectedCases = new Set();

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
  
  // КРИТИЧНО: Калькуляция - ПРОСТОЙ рендеринг БЕЗ виртуализации
  if (data.grouped && data.grouped.length > 0) {
    console.log('[Results] Рендеринг калькуляции, строк:', data.grouped.length);
    console.log('[Results] Первые 3 строки:', data.grouped.slice(0, 3));
    renderCalculationTableSimple(data.grouped, 'processedTable');
  }
  
  if (data.fraudAnalysis && data.fraudAnalysis.length > 0) {
    applyFraudFilters();
  }
}

// НОВАЯ функция: простой рендеринг калькуляции
function renderCalculationTableSimple(data, containerId) {
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
  
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  
  const table = document.createElement('table');
  table.className = 'data-table';
  
  // Заголовки - берем из первой НЕ-сепараторной строки
  const firstDataRow = data.find(r => !r._separator);
  if (!firstDataRow) {
    container.innerHTML = '<div>Нет данных</div>';
    return;
  }
  
  const headers = Object.keys(firstDataRow).filter(h => !h.startsWith('_'));
  
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  
  headers.forEach((header, index) => {
    const th = document.createElement('th');
    th.textContent = header;
    th.dataset.column = index;
    th.addEventListener('click', () => sortCalculationTable(table, index));
    headerRow.appendChild(th);
  });
  
  // Данные
  const tbody = table.createTBody();
  
  data.forEach(row => {
    const tr = tbody.insertRow();
    
    if (row._separator) {
      // Сепаратор - одна ячейка на всю ширину
      tr.className = 'separator-row';
      const td = tr.insertCell();
      td.colSpan = headers.length;
      td.textContent = row._cashier || '';
    } else {
      // Обычная строка
      if (row._isFG) tr.className = 'fg-row';
      if (row._isOverall) tr.className = 'overall-row';
      
      headers.forEach(header => {
        const td = tr.insertCell();
        let value = row[header];
        
        if (typeof value === 'number') {
          td.textContent = formatNumber(value);
          if (header.includes('Профит') || header.includes('профит')) {
            td.className = value >= 0 ? 'num-positive' : 'num-negative';
          }
        } else {
          td.textContent = value || '';
        }
      });
    }
  });
  
  wrapper.appendChild(table);
  container.appendChild(wrapper);
  
  console.log('[Results] Калькуляция отрендерена, строк в tbody:', tbody.rows.length);
}

function sortCalculationTable(table, columnIndex) {
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  
  const currentDir = table.dataset.sortDir || 'desc';
  const newDir = currentDir === 'desc' ? 'asc' : 'desc';
  table.dataset.sortDir = newDir;
  
  rows.sort((a, b) => {
    if (a.classList.contains('separator-row')) return -1;
    if (b.classList.contains('separator-row')) return 1;
    
    const aText = a.cells[columnIndex]?.textContent.trim() || '';
    const bText = b.cells[columnIndex]?.textContent.trim() || '';
    
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

// Рендеринг сводки ФГ
function renderFGSummaryTable(data, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  table.innerHTML = '';
  
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const headers = Object.keys(data[0]).filter(key => !key.startsWith('_') && key !== 'Export');
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
      
      // Компактное отображение касс
      if (header === 'Кассы' && typeof value === 'string' && value.length > 100) {
        const cashiers = value.split(', ');
        if (cashiers.length > 3) {
          const preview = cashiers.slice(0, 3).join(', ');
          const remaining = cashiers.length - 3;
          td.innerHTML = `${preview} <span style="color:#999; cursor:help;" title="${value}">...и ещё ${remaining}</span>`;
          td.dataset.fullValue = value;
        } else {
          td.textContent = value;
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
  selectedCases.clear();
  document.querySelectorAll('.fraud-case-checkbox').forEach(cb => {
    const fraudCase = cb.closest('.fraud-case');
    if (fraudCase && fraudCase.style.display !== 'none') {
      cb.checked = true;
      selectedCases.add(cb.dataset.caseId);
    }
  });
  console.log('[Results] toggleSelectAll: выбрано', selectedCases.size);
  updateSelectedCount();
}

function toggleSelectNone() {
  selectedCases.clear();
  document.querySelectorAll('.fraud-case-checkbox').forEach(cb => {
    cb.checked = false;
  });
  console.log('[Results] toggleSelectNone: выбрано', selectedCases.size);
  updateSelectedCount();
}

function updateSelectedCount() {
  const visibleCheckboxes = Array.from(document.querySelectorAll('.fraud-case-checkbox'))
    .filter(cb => {
      const fraudCase = cb.closest('.fraud-case');
      return fraudCase && fraudCase.style.display !== 'none';
    });
  const total = visibleCheckboxes.length;
  document.getElementById('selectedCount').textContent = `Выбрано: ${selectedCases.size} из ${total}`;
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
  
  console.log('[Results] Фрод-анализ отрендерен, globalIndex:', globalIndex);
}

function createFraudCaseElement(fraudCase, index) {
  const div = document.createElement('div');
  div.className = `fraud-case severity-${fraudCase.severity.toLowerCase()}`;
  
  const caseId = `case_${index}`;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'fraud-case-checkbox';
  checkbox.dataset.caseId = caseId;
  checkbox.dataset.caseIndex = index; // КРИТИЧНО
  checkbox.checked = selectedCases.has(caseId);
  checkbox.style.marginRight = '12px';
  checkbox.style.cursor = 'pointer';
  checkbox.onchange = (e) => {
    if (e.target.checked) {
      selectedCases.add(caseId);
      console.log('[Checkbox] Добавлен:', caseId, 'index:', index);
    } else {
      selectedCases.delete(caseId);
      console.log('[Checkbox] Удален:', caseId);
    }
    console.log('[Checkbox] Текущий selectedCases:', Array.from(selectedCases));
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
