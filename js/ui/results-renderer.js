'use strict';

/**
 * Рендерит компактную таблицу сводки ФГ
 */
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
  
  // Оборачиваем таблицу в скроллируемый контейнер
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  
  const table = document.createElement('table');
  table.className = 'data-table';
  
  // Заголовки
  const headers = Object.keys(data[0]).filter(h => !h.startsWith('_') && h !== 'Export');
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  
  headers.forEach((header, index) => {
    const th = document.createElement('th');
    th.textContent = header;
    th.onclick = () => sortTable(table, index);
    th.title = 'Сортировать';
    headerRow.appendChild(th);
  });
  
  // Данные
  const tbody = table.createTBody();
  
  data.forEach(row => {
    const tr = tbody.insertRow();
    
    headers.forEach(header => {
      const td = tr.insertCell();
      let value = row[header];
      
      if (typeof value === 'number' || !isNaN(parseFloat(value))) {
        const num = parseFloat(value);
        td.textContent = formatNumber(num);
        
        if (header.includes('Проф')) {
          td.className = num >= 0 ? 'num-positive' : 'num-negative';
        }
      } else {
        td.textContent = value || '';
      }
    });
  });
  
  wrapper.appendChild(table);
  container.appendChild(wrapper);
}

/**
 * Сортировка таблицы
 */
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

/**
 * Форматирование чисел
 */
function formatNumber(num) {
  if (isNaN(num)) return num;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Рендерит виртуализированную таблицу калькуляции
 */
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
  
  // Сокращенные заголовки
  const headerMap = {
    'Номер игрока': 'ID',
    'Игрок': 'Имя',
    'Сумма пополнений (в валюте админа по курсу текущего дня)': 'Деп. $',
    'Сумма вывода (в валюте админа по курсу текущего дня)': 'Выв. $',
    'Количество пополнений': '№ Д',
    'Количество выводов': '№ В',
    'Касса': 'Касса',
    'Комиссия': 'Ком.',
    'Средний депозит': 'Ср.Д',
    'Средний вывод': 'Ср.В',
    'Профит': 'Проф.'
  };
  
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  wrapper.style.maxHeight = '600px';
  wrapper.style.overflowY = 'auto';
  
  const table = document.createElement('table');
  table.className = 'data-table';
  
  const allHeaders = Object.keys(data[0]).filter(h => !h.startsWith('_'));
  const displayHeaders = allHeaders.filter(h => 
    headerMap[h] || ['Комиссия', 'Средний депозит', 'Средний вывод', 'Профит'].includes(h)
  );
  
  // Заголовки
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  
  displayHeaders.forEach(header => {
    const th = document.createElement('th');
    th.textContent = headerMap[header] || header;
    th.title = header;
    headerRow.appendChild(th);
  });
  
  const tbody = table.createTBody();
  
  // Разделяем по типам
  const fgRows = data.filter(r => r._isFG);
  const playerRows = data.filter(r => !r._isFG && !r._isOverall && !r._separator);
  const overallRow = data.find(r => r._isOverall);
  
  // Функция рендера чанка
  function renderChunk(chunkIndex) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, playerRows.length);
    
    for (let i = start; i < end; i++) {
      const row = playerRows[i];
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
    }
  }
  
  // ФГ наверху
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
  
  const grouped = {};
  cases.forEach(c => {
    const agent = c.agentName || 'Неизвестный агент';
    if (!grouped[agent]) grouped[agent] = [];
    grouped[agent].push(c);
  });
  
  Object.keys(grouped).sort().forEach(agent => {
    const agentSection = document.createElement('div');
    agentSection.style.marginBottom = '24px';
    
    const agentHeader = document.createElement('h3');
    agentHeader.textContent = agent;
    agentHeader.style.marginBottom = '12px';
    agentHeader.style.color = '#667eea';
    agentSection.appendChild(agentHeader);
    
    grouped[agent].forEach(fraudCase => {
      const div = document.createElement('div');
      div.className = `fraud-case`;
      
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
