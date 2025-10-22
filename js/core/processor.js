'use strict';

/**
 * Обрабатывает данные: рассчитывает комиссии, профит
 * Портировано из processData() в .gs файле
 */
function processData(data, config) {
  const { depCommission, withCommission, cashierColumn } = config;
  
  // Определяем имена колонок
  const headers = Object.keys(data[0]);
  const cashierKey = headers[cashierColumn];
  
  console.log('[Processor] Обработка', data.length, 'строк');
  console.log('[Processor] Всего колонок:', headers.length);
  console.log('[Processor] Названия колонок:', headers);
  console.log('[Processor] Выбран индекс кассы:', cashierColumn);
  console.log('[Processor] Имя колонки кассы:', cashierKey);
  
  if (!cashierKey) {
    console.error('[Processor] ОШИБКА: Колонка кассы не найдена!');
    console.error('[Processor] Возможно выбран неверный индекс или в CSV меньше колонок');
    throw new Error(`Колонка с индексом ${cashierColumn} не существует. Всего колонок: ${headers.length}`);
  }
  
  const processed = data.map((row, index) => {
    // Парсим числовые значения
    const parseNum = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const str = String(val).replace(/[\s]/g, '');
      return parseFloat(str) || 0;
    };
    
    // Получаем значения (поддержка разных названий колонок)
    const depSumUsd = parseNum(
      row['Сумма пополнений (в валюте админа по курсу текущего дня)'] ||
      row['Сумма пополнений (в валюте админа)'] ||
      0
    );
    
    const withSumUsd = parseNum(
      row['Сумма вывода (в валюте админа по курсу текущего дня)'] ||
      row['Сумма вывода (в валюте админа)'] ||
      0
    );
    
    const depCount = parseNum(row['Количество пополнений'] || 0);
    const withCount = parseNum(row['Количество выводов'] || 0);
    
    // Расчеты
    const depCommissionAmount = (depSumUsd * depCommission) / 100;
    const withCommissionAmount = (withSumUsd * withCommission) / 100;
    const totalCommission = depCommissionAmount + withCommissionAmount;
    
    const avgDep = depCount > 0 ? depSumUsd / depCount : 0;
    const avgWith = withCount > 0 ? withSumUsd / withCount : 0;
    const profit = depSumUsd - withSumUsd - totalCommission;
    
    // Возвращаем обогащенную строку
    return {
      ...row,
      '_index': index,
      '_cashierColumn': cashierKey,
      'Комиссия': round2(totalCommission),
      'Средний депозит': round2(avgDep),
      'Средний вывод': round2(avgWith),
      'Профит': round2(profit)
    };
  });
  
  // Строим единый маппинг кассы → агент
  const cashierToAgent = buildCashierToAgentMapping(processed, headers, cashierKey);
  
  console.log('[Processor] Построен маппинг:', Object.keys(cashierToAgent).length, 'записей');
  
  return { processed, cashierToAgent };
}

/**
 * Строит маппинг касса → агент из строк ФГ
 */
function buildCashierToAgentMapping(data, headers, cashierKey) {
  const mapping = {};
  
  data.forEach(row => {
    if (!row._isFG) return;
    
    const col0 = String(row[headers[0]] || '').trim();
    const col1 = String(row[headers[1]] || '').trim();
    
    // Извлечение имени агента (убираем префикс "ФГ:" если есть)
    let agentName = null;
    let cashierInfo = null;
    
if (col0.startsWith('ФГ:')) {
  agentName = col0.substring(3).trim();
  cashierInfo = col1;
} else if (col1.startsWith('ФГ:')) {
  agentName = col1.substring(3).trim();
  cashierInfo = col0;
}
    
    if (!agentName || !cashierInfo) return;
    
    // Получаем полное имя кассы из основной колонки
    let fullCashierName = String(row[cashierKey] || '').trim();
    if (!fullCashierName) fullCashierName = cashierInfo;
    
    const cashierId = extractCashierId(fullCashierName || cashierInfo);
    
    if (cashierId && agentName) {
      // Создаем все варианты маппинга для надежности
      mapping[cashierId] = agentName;
      mapping[fullCashierName] = agentName;
      mapping[cashierInfo] = agentName;
      
      // Нормализованный формат "12345 City" вместо "12345, City"
      const normalized = cashierInfo.replace(/^(\d+),\s*/, '$1 ');
      mapping[normalized] = agentName;
      
      console.log('[Processor] Маппинг:', cashierId, '→', agentName);
    }
  });
  
  return mapping;
}

/**
 * Извлекает ID кассы из строки
 */
function extractCashierId(cashierStr) {
  const match = String(cashierStr).match(/(\d+)[,\s]/);
  return match ? match[1] : cashierStr;
}

/**
 * Группирует данные по кассам и сортирует по профиту
 * ИСПРАВЛЕНО: ФГ теперь наверху, отсортированы по профиту
 */
function groupData(data, cashierColumn) {
  const headers = Object.keys(data[0]);
  const cashierKey = headers[cashierColumn];
  
  console.log('[Processor] Группировка по колонке', cashierColumn, '→', cashierKey);
  console.log('[Processor] Доступные заголовки:', headers);
  console.log('[Processor] Пример первой строки:', data[0]);
  
  // Валидация
  if (!cashierKey) {
    console.error('[Processor] КРИТИЧЕСКАЯ ОШИБКА: cashierKey не определен!');
    throw new Error(`Колонка с индексом ${cashierColumn} не существует`);
  }
  
  // Отделяем строки ФГ и обычные строки
  const fgRows = [];
  const playerRows = [];
  let overallRow = null;
  
  data.forEach(row => {
    const col0 = String(row[headers[0]] || '').trim();
    const col1 = String(row[headers[1]] || '').trim();
    
    // Проверка на строку ФГ
    if (col0.startsWith('ФГ:') || col1.startsWith('ФГ:')) {
      fgRows.push({ ...row, _isFG: true });
    }
    // Проверка на Итого/Overall
    else if (col1 === 'Итого' || col1 === 'Overall' || col0 === 'Итого' || col0 === 'Overall') {
      overallRow = { ...row, _isOverall: true };
    }
    // Обычная строка игрока
    else {
      playerRows.push(row);
    }
  });
  
  console.log('[Processor] Игроков:', playerRows.length, 'ФГ:', fgRows.length);
  
  // Группируем игроков по кассам
  const grouped = {};
  playerRows.forEach((row, idx) => {
    const cashier = row[cashierKey] || 'Неизвестно';
    if (idx === 0) {
      console.log('[Processor] Пример игрока:', row);
      console.log('[Processor] Касса из строки:', cashier);
    }
    if (!grouped[cashier]) {
      grouped[cashier] = [];
    }
    grouped[cashier].push(row);
  });
  
  console.log('[Processor] Кассы найдены:', Object.keys(grouped));
  console.log('[Processor] Игроков по кассам:', Object.entries(grouped).map(([k, v]) => `${k}: ${v.length}`));
  
  // Сортируем внутри каждой группы по профиту
  Object.keys(grouped).forEach(cashier => {
    grouped[cashier].sort((a, b) => {
      return parseFloat(a['Профит']) - parseFloat(b['Профит']);
    });
  });
  
  // ИСПРАВЛЕНИЕ: Собираем результат в порядке ФГ → кассы → Итого
  const result = [];
  
  // 1. Финансовые группы НАВЕРХУ (сортированные по профиту)
  if (fgRows.length > 0) {
    fgRows.sort((a, b) => {
      const profitA = parseFloat(a['Профит']) || 0;
      const profitB = parseFloat(b['Профит']) || 0;
      return profitA - profitB;  // от меньшего к большему
    });
    
    result.push({
      _separator: true,
      _cashier: '═══ Финансовые группы ═══'
    });
    result.push(...fgRows);
    
    console.log('[Processor] ФГ добавлены наверх:', fgRows.length, 'строк');
  }
  
  // 2. Кассы с игроками
  Object.keys(grouped).sort().forEach(cashier => {
    result.push({
      _separator: true,
      _cashier: cashier
    });
    result.push(...grouped[cashier]);
  });
  
  // 3. Итого
  if (overallRow) {
    result.push({
      _separator: true,
      _cashier: '═══ ИТОГО ═══'
    });
    result.push(overallRow);
  }
  
  console.log('[Processor] Результат группировки:', result.length, 'строк');
  return result;
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

// В Web Worker нет DOM, экспортируем через глобальный scope
if (typeof self !== 'undefined' && self.importScripts) {
  self.processData = processData;
  self.groupData = groupData;
  self.round2 = round2;
  self.extractCashierId = extractCashierId;
  self.buildCashierToAgentMapping = buildCashierToAgentMapping;
}
