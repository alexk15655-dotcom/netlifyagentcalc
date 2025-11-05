'use strict';

let currentTab = 'fgSummary';

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

function loadResults() {
  const results = localStorage.getItem('cashierCheckupResults');
  
  if (!results) {
    window.location.href = 'index.html';
    return;
  }
  
  const data = JSON.parse(results);
  window.cashierCheckupResults = data;
  window.allFraudCases = data.fraudAnalysis || [];
  window.filteredFraudCases = [...window.allFraudCases];
  
  console.log('[Results] Загружено:', {
    processed: data.processed?.length,
    grouped: data.grouped?.length,
    fraud: data.fraudAnalysis?.length,
    fgSummary: data.fgSummary?.length
  });
  
  if (data.fgSummary && data.fgSummary.length > 0) {
    renderTable(data.fgSummary, 'fgSummaryTable');
  }
  
  if (data.grouped && data.grouped.length > 0) {
    renderTable(data.grouped, 'processedTable');
  }
  
  if (data.fraudAnalysis && data.fraudAnalysis.length > 0) {
    applyFraudFilters();
  }
}

function renderTable(data, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  table.innerHTML = '';
  
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const headers = Object.keys(data[0]).filter(key => !key.startsWith('_'));
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
    
    if (row._separator) {
      tr.classList.add('separator-row');
      const td = document.createElement('td');
      td.colSpan = headers.length;
      td.textContent = row[headers[0]] || '';
      tr.appendChild(td);
    } else {
      if (row._isFG) tr.classList.add('fg-row');
      if (row._isOverall) tr.classList.add('overall-row');
      
      headers.forEach(header => {
        const td = document.createElement('td');
        const value = row[header];
        
        if (typeof value === 'number') {
          td.textContent = formatNumber(value);
          td.className = value >= 0 ? 'num-positive' : 'num-negative';
        } else {
          td.textContent = value || '';
        }
        
        tr.appendChild(td);
      });
    }
    
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
