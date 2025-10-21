'use strict';

let cashierCheckupResults = null;

document.addEventListener('DOMContentLoaded', () => {
  loadResults();
});

function openDB() {
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

function getResults() {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['results'], 'readonly');
      const store = transaction.objectStore('results');
      const request = store.get('lastProcessing');
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  });
}

function loadResults() {
  getResults()
    .then(results => {
      if (!results) {
        alert('Нет данных. Вернитесь на главную страницу.');
        window.location.href = 'index.html';
        return;
      }
      
      cashierCheckupResults = results;
      window.cashierCheckupResults = results;
      
      console.log('[Results] Загружены результаты:', results);
      
      initTabs();
      renderAllTabs();
    })
    .catch(error => {
      alert('Ошибка загрузки результатов: ' + error.message);
      window.location.href = 'index.html';
    });
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
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

function renderAllTabs() {
  const results = cashierCheckupResults;
  
  // 1. Сводка ФГ (теперь первый таб)
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
  
  // 2. Калькуляция - виртуализация для больших данных
  if (results.grouped && results.grouped.length > 0) {
    renderGroupedTableVirtualized(results.grouped, 'processedTable');
  }
  
  // 3. Фрод-анализ
  window.allFraudCases = results.fraudAnalysis || [];
  window.filteredFraudCases = [...window.allFraudCases];
  applyFraudFilters();
}

// Виртуализированная таблица для больших данных
function renderGroupedTableVirtualized(data, containerId) {
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
  
  const CHUNK_SIZE = 100;
  let currentChunk = 0;
  
  const headerMap = {
    'Номер игрока': 'ID',
    'Игрок': 'Имя',
    'Сумма пополнений': 'Деп.',
    'Сумма вывода': 'Выв.',
    'Сумма пополнений (в валюте админа по курсу текущего дня)': 'Деп. USD',
    'Сумма вывода (в валюте админа по курсу текущего дня)': 'Выв. USD',
    'Количество пополнений': '№ Деп.',
    'Количество выводов': '№ Выв.',
    'Касса': 'Касса',
    'Комиссия': 'Ком.',
    'Средний депозит': 'Ср. Деп.',
    'Средний вывод': 'Ср. Выв.',
    'Профит': 'Профит'
  };
  
  const displayHeaders = [
    'Номер игрока', 'Игрок', 'Сумма пополнений', 'Сумма вывода',
    'Сумма пополнений (в валюте админа по курсу текущего дня)',
    'Сумма вывода (в валюте админа по курсу текущего дня)',
    'Количество пополнений', 'Количество выводов', 'Касса',
    'Комиссия', 'Средний депозит', 'Средний вывод', 'Профит'
  ];
  
  const wrapper = document.createElement('div');
  wrapper.className = 'virtualized-table-wrapper';
  wrapper.style.overflowY = 'auto';
  wrapper.style.maxHeight = 'calc(100vh - 300px)';
  
  const table = document.createElement('table');
  table.className = 'data-table';
  
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  
  displayHeaders.forEach((header, index) => {
    const th = document.createElement('th');
    th.textContent = headerMap[header] || header;
    th.title = header;
    th.onclick = () => sortTable(table, index);
    headerRow.appendChild(th);
  });
  
  const tbody = table.createTBody();
  tbody.id = 'virtualizedBody';
  
  const fgRows = data.filter(row => row._isFG);
  const playerRows = data.filter(row => !row._isFG && !row._isOverall && !row._separator);
  const overallRow = data.find(row => row._isOverall);
  
  function renderChunk(chunk) {
    const start = chunk * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, playerRows.length);
    const rows = playerRows.slice(start, end);
    
    const grouped = {};
    const cashierKey = playerRows[0]?._cashierColumn || 'Касса';
    
    rows.forEach(row => {
      const cashier = String(row[cashierKey] || 'Неизвестно').trim();
      if (!grouped[cashier]) grouped[cashier] = [];
      grouped[cashier].push(row);
    });
    
    Object.keys(grouped).sort().forEach(cashier => {
      const separatorRow = tbody.insertRow();
      separatorRow.className = 'separator-row';
      const td = separatorRow.insertCell();
      td.colSpan = displayHeaders.length;
      td.textContent = `─── ${cashier} ───`;
      
      grouped[cashier].forEach(row => {
        const tr = tbody.insertRow();
        
        displayHeaders.forEach(header => {
          const td = tr.insertCell();
          const value = row[header];
          
          if (typeof value === 'number' || !isNaN(parseFloat(value))) {
            const num = parseFloat(value);
            td.textContent = formatNumber(num);
            
            if (header === 'Профит') {
              td.className = num >= 0 ? 'num-positive' : 'num-negative';
            }
          } else {
            td.textContent = value || '';
          }
        });
      });
    });
  }
  
  // ФГ
  if (fgRows.length > 0) {
    const separatorRow = tbody.insertRow();
    separatorRow.className = 'separator-row';
    const td = separatorRow.insertCell();
    td.colSpan = displayHeaders.length;
    td.textContent = '═══ Финансовые группы ═══';
    
    fgRows.forEach(row => {
      const tr = tbody.insertRow();
      tr.className = 'fg-row';
      
      displayHeaders.forEach(header => {
        const td = tr.insertCell();
        const value = row[header];
        
        if (typeof value === 'number' || !isNaN(parseFloat(value))) {
          const num = parseFloat(value);
          td.textContent = formatNumber(num);
          
          if (header === 'Профит') {
            td.className = num >= 0 ? 'num-positive' : 'num-negative';
          }
        } else {
          td.textContent = value || '';
        }
      });
    });
  }
  
  renderChunk(0);
  
  // Ленивая загрузка
  wrapper.onscroll = () => {
    if (wrapper.scrollTop + wrapper.clientHeight >= wrapper.scrollHeight - 100) {
      currentChunk++;
      if (currentChunk * CHUNK_SIZE < playerRows.length) {
        renderChunk(currentChunk);
      }
    }
  };
  
  // Итого
  if (overallRow) {
    const separatorRow = tbody.insertRow();
    separatorRow.className = 'separator-row';
    const td = separatorRow.insertCell();
    td.colSpan = displayHeaders.length;
    td.textContent = '═══ ИТОГО ═══';
    
    const tr = tbody.insertRow();
    tr.className = 'overall-row';
    
    displayHeaders.forEach(header => {
      const td = tr.insertCell();
      const value = overallRow[header];
      
      if (typeof value === 'number' || !isNaN(parseFloat(value))) {
        const num = parseFloat(value);
        td.textContent = formatNumber(num);
        
        if (header === 'Профит') {
          td.className = num >= 0 ? 'num-positive' : 'num-negative';
        }
      } else {
        td.textContent = value || '';
      }
    });
  }
  
  wrapper.appendChild(table);
  container.appendChild(wrapper);
}

function renderTable(data, containerId) {
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
  
  const table = document.createElement('table');
  table.className = 'data-table';
  
  const headers = Object.keys(data[0]).filter(h => !h.startsWith('_'));
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  
  headers.forEach((header, index) => {
    const th = document.createElement('th');
    th.textContent = header;
    th.onclick = () => sortTable(table, index);
    th.title = 'Кликните для сортировки';
    headerRow.appendChild(th);
  });
  
  const tbody = table.createTBody();
  
  data.forEach(row => {
    const tr = tbody.insertRow();
    
    headers.forEach(header => {
      const td = tr.insertCell();
      let value = row[header];
      
      if (header === 'Кассы' || header === 'Export') {
        td.textContent = value || '';
        td.style.whiteSpace = 'pre-wrap';
      }
      else if (typeof value === 'number' || !isNaN(parseFloat(value))) {
        const num = parseFloat(value);
        td.textContent = formatNumber(num);
        
        if (header.includes('Профит') || header.includes('Прибыль')) {
          td.className = num >= 0 ? 'num-positive' : 'num-negative';
        }
      } else {
        td.textContent = value || '';
      }
    });
  });
  
  container.appendChild(table);
}

function sortTable(table, columnIndex) {
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);
  
  const currentDir = table.dataset.sortDir || 'asc';
  const newDir = currentDir === 'asc' ? 'desc' : 'asc';
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
    'AGENT_SELF_PLAY': document.getElementById('filterAgentSelfPlay')?.checked ?? true,
    'EMPTY_ACCOUNTS': document.getElementById('filterEmptyAccounts')?.checked ?? true,
    'TRASH_ACCOUNTS': document.getElementById('filterTrashAccounts')?.checked ?? true,
    'MULTI_ACCOUNTS': document.getElementById('filterMultiAccounts')?.checked ?? true
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
  
  sorted.forEach(fraudCase => {
    const div = createFraudCaseElement(fraudCase);
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
      grouped[severity][agent] = [];
    }
    grouped[severity][agent].push(c);
  });
  
  ['HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
    const agents = grouped[severity];
    const agentNames = Object.keys(agents);
    
    if (agentNames.length === 0) return;
    
    const severityHeader = document.createElement('h2');
    severityHeader.textContent = `${severity} (${agentNames.reduce((sum, a) => sum + agents[a].length, 0)})`;
    severityHeader.style.marginTop = '40px';
    severityHeader.style.marginBottom = '20px';
    severityHeader.style.color = severity === 'HIGH' ? '#c62828' : severity === 'MEDIUM' ? '#ef6c00' : '#2e7d32';
    container.appendChild(severityHeader);
    
    agentNames.sort().forEach(agent => {
      const agentSection = document.createElement('div');
      agentSection.style.marginBottom = '24px';
      
      const agentHeader = document.createElement('h3');
      agentHeader.textContent = `${agent} (${agents[agent].length})`;
      agentHeader.style.marginBottom = '12px';
      agentHeader.style.color = '#667eea';
      agentHeader.style.fontSize = '18px';
      agentSection.appendChild(agentHeader);
      
      agents[agent].forEach(fraudCase => {
        const div = createFraudCaseElement(fraudCase);
        agentSection.appendChild(div);
      });
      
      container.appendChild(agentSection);
    });
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

function formatNumber(num) {
  if (isNaN(num)) return num;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}