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
  
  // 1. Калькуляция
  if (results.grouped && results.grouped.length > 0) {
    renderGroupedTable(results.grouped, 'processedTable');
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

function renderGroupedTable(data, containerId) {
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
  
  // Заголовки (исключаем служебные)
  const headers = Object.keys(data[0]).filter(h => !h.startsWith('_'));
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  
  headers.forEach((header, index) => {
    const th = document.createElement('th');
    th.textContent = header;
    th.onclick = () => sortTable(table, index + 1);
    th.title = 'Кликните для сортировки';
    headerRow.appendChild(th);
  });
  
  const tbody = table.createTBody();
  
  // Разделяем ФГ и остальное
  const fgRows = [];
  const cashierRows = [];
  let overallRow = null;
  
  data.forEach(row => {
    if (row._isFG) {
      fgRows.push(row);
    } else if (row._isOverall) {
      overallRow = row;
    } else if (!row._separator) {
      cashierRows.push(row);
    }
  });
  
  // Рендерим: ФГ → разделитель → кассы → разделитель → итого
  
  // 1. Финансовые группы
  if (fgRows.length > 0) {
    const separatorRow = tbody.insertRow();
    separatorRow.className = 'separator-row';
    const td = separatorRow.insertCell();
    td.colSpan = headers.length;
    td.textContent = '═══ Финансовые группы ═══';
    
    fgRows.forEach(row => {
      const tr = tbody.insertRow();
      tr.className = 'fg-row';
      
      headers.forEach(header => {
        const td = tr.insertCell();
        let value = row[header];
        
        if (typeof value === 'number' || !isNaN(parseFloat(value))) {
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
  }
  
  // 2. Кассы с игроками
  if (cashierRows.length > 0) {
    // Группируем по кассам
    const grouped = {};
    let currentCashier = null;
    
    cashierRows.forEach(row => {
      const cashierValue = Object.values(row).find(v => 
        String(v).match(/^\d+[,\s]/) || String(v).includes('Baku') || String(v).includes('Кассa')
      );
      
      if (cashierValue && cashierValue !== currentCashier) {
        currentCashier = cashierValue;
        grouped[currentCashier] = [];
      }
      
      if (currentCashier) {
        grouped[currentCashier].push(row);
      }
    });
    
    // Рендерим кассы с разделителями
    Object.entries(grouped).forEach(([cashier, rows]) => {
      const separatorRow = tbody.insertRow();
      separatorRow.className = 'separator-row';
      const td = separatorRow.insertCell();
      td.colSpan = headers.length;
      td.textContent = `─── ${cashier} ───`;
      
      rows.forEach(row => {
        const tr = tbody.insertRow();
        
        headers.forEach(header => {
          const td = tr.insertCell();
          let value = row[header];
          
          if (typeof value === 'number' || !isNaN(parseFloat(value))) {
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
    });
  }
  
  // 3. Итого
  if (overallRow) {
    const separatorRow = tbody.insertRow();
    separatorRow.className = 'separator-row';
    const td = separatorRow.insertCell();
    td.colSpan = headers.length;
    td.textContent = '═══ ИТОГО ═══';
    
    const tr = tbody.insertRow();
    tr.className = 'overall-row';
    
    headers.forEach(header => {
      const td = tr.insertCell();
      let value = overallRow[header];
      
      if (typeof value === 'number' || !isNaN(parseFloat(value))) {
        const num = parseFloat(value);
        td.textContent = formatNumber(num);
        
        if (header.includes('Профит') || header.includes('Прибыль')) {
          td.className = num >= 0 ? 'num-positive' : 'num-negative';
        }
      } else {
        td.textContent = value || '';
      }
    });
  }
  
  container.appendChild(table);
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
    th.onclick = () => sortTable(table, index + 1);
    th.title = 'Кликните для сортировки';
    headerRow.appendChild(th);
  });
  
  const tbody = table.createTBody();
  
  data.forEach(row => {
    const tr = tbody.insertRow();
    
    headers.forEach(header => {
      const td = tr.insertCell();
      let value = row[header];
      
      // Для колонок "Кассы" и "Export" сохраняем текстовый формат
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
    
    const aText = a.cells[columnIndex - 1].textContent.trim();
    const bText = b.cells[columnIndex - 1].textContent.trim();
    
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

function formatNumber(num) {
  if (isNaN(num)) return num;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}
