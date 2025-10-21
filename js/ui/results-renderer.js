'use strict';

/**
 * Рендерит таблицу с данными
 */
function renderTable(data, containerId, options = {}) {
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
  
  // Заголовки
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
  
  // Данные
  const tbody = table.createTBody();
  
  data.forEach(row => {
    // Проверка на разделитель
    if (row._separator) {
      const tr = tbody.insertRow();
      tr.className = 'separator-row';
      const td = tr.insertCell();
      td.colSpan = headers.length;
      td.textContent = row._cashier || 'Разделитель';
      return;
    }
    
    const tr = tbody.insertRow();
    
    // Специальные классы для строк
    if (row._isFG) {
      tr.className = 'fg-row';
    } else if (row._isOverall) {
      tr.className = 'overall-row';
    }
    
    headers.forEach(header => {
      const td = tr.insertCell();
      let value = row[header];
      
      // Форматирование чисел
      if (typeof value === 'number' || !isNaN(parseFloat(value))) {
        const num = parseFloat(value);
        td.textContent = formatNumber(num);
        
        // Цвет для профита
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

/**
 * Сортировка таблицы по колонке
 */
function sortTable(table, columnIndex) {
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);
  
  // Определяем направление сортировки
  const currentDir = table.dataset.sortDir || 'asc';
  const newDir = currentDir === 'asc' ? 'desc' : 'asc';
  table.dataset.sortDir = newDir;
  
  // Сортируем
  rows.sort((a, b) => {
    // Пропускаем разделители
    if (a.classList.contains('separator-row')) return -1;
    if (b.classList.contains('separator-row')) return 1;
    
    const aText = a.cells[columnIndex - 1].textContent.trim();
    const bText = b.cells[columnIndex - 1].textContent.trim();
    
    // Пробуем как числа
    const aNum = parseFloat(aText.replace(/[^\d.-]/g, ''));
    const bNum = parseFloat(bText.replace(/[^\d.-]/g, ''));
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return newDir === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    // Иначе как строки
    return newDir === 'asc' ?
      aText.localeCompare(bText, 'ru') :
      bText.localeCompare(aText, 'ru');
  });
  
  // Обновляем таблицу
  rows.forEach(row => tbody.appendChild(row));
}

/**
 * Рендерит результаты проверки имен
 */
function renderNameCheck(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">Подозрительных совпадений не найдено</div>
      </div>
    `;
    return;
  }
  
  data.forEach(item => {
    const div = document.createElement('div');
    div.className = 'namecheck-item';
    
    let html = `<strong>ID ${item.id}</strong> - ${item.name}<br>`;
    html += `<small>Касса: ${item.cashier}</small><br>`;
    
    if (item.similarIds) {
      html += `<small>Похожие ID: ${item.similarIds}</small><br>`;
    }
    
    if (item.otherCashiers) {
      html += `<small>Другие кассы: ${item.otherCashiers}</small>`;
    }
    
    div.innerHTML = html;
    container.appendChild(div);
  });
}

/**
 * Рендерит фрод-анализ
 */
function renderFraud(cases, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!cases || cases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">Подозрительных случаев не найдено</div>
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
    
    grouped[agent].forEach(fraudCase => {
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
      agentSection.appendChild(div);
    });
    
    container.appendChild(agentSection);
  });
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
