'use strict';

function processData(data, config) {
  const { depCommission, withCommission, cashierColumn, findSimilarNames } = config;
  
  const headers = Object.keys(data[0]);
  const cashierKey = headers[cashierColumn];
  
  console.log('[Processor] Обработка', data.length, 'строк');
  console.log('[Processor] findSimilarNames:', findSimilarNames);
  
  if (!cashierKey) {
    throw new Error(`Колонка с индексом ${cashierColumn} не существует. Всего колонок: ${headers.length}`);
  }
  
  const processed = data.map((row, index) => {
    const parseNum = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const str = String(val).replace(/[\s]/g, '');
      return parseFloat(str) || 0;
    };
    
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
    
    const depCommissionAmount = (depSumUsd * depCommission) / 100;
    const withCommissionAmount = (withSumUsd * withCommission) / 100;
    const totalCommission = depCommissionAmount + withCommissionAmount;
    
    const avgDep = depCount > 0 ? depSumUsd / depCount : 0;
    const avgWith = withCount > 0 ? withSumUsd / withCount : 0;
    const profit = depSumUsd - withSumUsd - totalCommission;
    
    return {
      ...row,
      '_index': index,
      '_cashierColumn': cashierKey,
      'Комиссия': round2(totalCommission),
      'Средний депозит': round2(avgDep),
      'Средний вывод': round2(avgWith),
      'Профит': round2(profit),
      'Похожие имена': '' // заполнится позже
    };
  });
  
  const cashierToAgent = buildCashierToAgentMapping(processed, headers, cashierKey);
  
  // ПУНКТ 5: Поиск похожих имен, если включено
  if (findSimilarNames) {
    console.log('[Processor] Поиск похожих имен...');
    findSimilarNamesInData(processed, headers, cashierKey);
    console.log('[Processor] Поиск похожих имен завершен');
  }
  
  return { processed, cashierToAgent };
}

// ПУНКТ 5: Функция поиска похожих имен
function findSimilarNamesInData(data, headers, cashierKey) {
  const idKey = headers.find(h => h.includes('игрока') || h.includes('Номер'));
  const nameKey = headers.find(h => h === 'Игрок' || h.includes('Имя'));
  
  if (!idKey || !nameKey) {
    console.warn('[Processor] Не найдены колонки ID или Name для поиска похожих');
    return;
  }
  
  // Группируем по кассам для оптимизации O(n²) → O(n×m)
  const byCashier = {};
  data.forEach((row, idx) => {
    if (row._isFG || row._isOverall || row._separator) return;
    
    const cashier = String(row[cashierKey] || '').trim();
    if (!cashier) return;
    
    if (!byCashier[cashier]) {
      byCashier[cashier] = [];
    }
    byCashier[cashier].push({ row, idx });
  });
  
  // Для каждой кассы ищем похожие
  Object.values(byCashier).forEach(players => {
    players.forEach(({ row, idx }) => {
      const playerName = String(row[nameKey] || '').trim();
      if (!playerName || row._isFG || row._isOverall) {
        return;
      }
      
      const similar = [];
      
      players.forEach(({ row: otherRow, idx: otherIdx }) => {
        if (idx === otherIdx) return;
        
        const otherName = String(otherRow[nameKey] || '').trim();
        if (!otherName || otherRow._isFG || otherRow._isOverall) {
          return;
        }
        
        const similarity = calculateNameSimilarity(playerName, otherName);
        
        if (similarity > 0.70) {
          const balance = parseFloat(otherRow['Профит']) || 0;
          similar.push({
            id: otherRow[idKey],
            name: otherName,
            balance: balance
          });
        }
      });
      
      // Сортировка по убыточности
      similar.sort((a, b) => a.balance - b.balance);
      
      // Форматируем результат
      if (similar.length > 0) {
        const top3 = similar.slice(0, 3);
        const formatted = top3.map(s => {
          const balanceStr = s.balance < 0 ? `(${Math.abs(Math.round(s.balance))}$)` : '';
          return `${s.id} ${balanceStr}`.trim();
        }).join(', ');
        
        data[idx]['Похожие имена'] = formatted;
      }
    });
  });
}

function calculateNameSimilarity(name1, name2) {
  const normalize = (name) => name.toLowerCase().replace(/\s+/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1.length === 0 || n2.length === 0) return 0;
  if (n1 === n2) return 1;

  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;

  const distance = levenshteinDistance(shorter, longer);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = Array(str1.length + 1).fill(null).map(() => Array(str2.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= str2.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[str1.length][str2.length];
}

function buildCashierToAgentMapping(data, headers, cashierKey) {
  const mapping = {};
  
  data.forEach(row => {
    const col0 = String(row[headers[0]] || '').trim();
    const col1 = String(row[headers[1]] || '').trim();
    
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
    
    let fullCashierName = String(row[cashierKey] || '').trim();
    if (!fullCashierName) fullCashierName = cashierInfo;
    
    const cashierId = extractCashierId(fullCashierName || cashierInfo);
    
    if (cashierId && agentName) {
      mapping[cashierId] = agentName;
      mapping[fullCashierName] = agentName;
      mapping[cashierInfo] = agentName;
      
      const normalized = cashierInfo.replace(/^(\d+),\s*/, '$1 ');
      mapping[normalized] = agentName;
    }
  });
  
  return mapping;
}

function extractCashierId(cashierStr) {
  const match = String(cashierStr).match(/(\d+)[,\s]/);
  return match ? match[1] : cashierStr;
}

function groupData(data, cashierColumn) {
  const headers = Object.keys(data[0]);
  const cashierKey = headers[cashierColumn];
  
  if (!cashierKey) {
    throw new Error(`Колонка с индексом ${cashierColumn} не существует`);
  }
  
  const fgRows = [];
  const playerRows = [];
  let overallRow = null;
  
  data.forEach(row => {
    const col0 = String(row[headers[0]] || '').trim();
    const col1 = String(row[headers[1]] || '').trim();
    
    if (col0.startsWith('ФГ:') || col1.startsWith('ФГ:')) {
      fgRows.push({ ...row, _isFG: true });
    }
    else if (col1 === 'Итого' || col1 === 'Overall' || col0 === 'Итого' || col0 === 'Overall') {
      overallRow = { ...row, _isOverall: true };
    }
    else {
      playerRows.push(row);
    }
  });
  
  const grouped = {};
  playerRows.forEach((row) => {
    const cashier = row[cashierKey] || 'Неизвестно';
    if (!grouped[cashier]) {
      grouped[cashier] = [];
    }
    grouped[cashier].push(row);
  });
  
  Object.keys(grouped).forEach(cashier => {
    grouped[cashier].sort((a, b) => {
      return parseFloat(a['Профит']) - parseFloat(b['Профит']);
    });
  });
  
  const result = [];
  
  if (fgRows.length > 0) {
    fgRows.sort((a, b) => {
      const profitA = parseFloat(a['Профит']) || 0;
      const profitB = parseFloat(b['Профит']) || 0;
      return profitA - profitB;
    });
    
    result.push({
      _separator: true,
      _cashier: '═══ Финансовые группы ═══'
    });
    result.push(...fgRows);
  }
  
  Object.keys(grouped).sort().forEach(cashier => {
    result.push({
      _separator: true,
      _cashier: cashier
    });
    result.push(...grouped[cashier]);
  });
  
  if (overallRow) {
    result.push({
      _separator: true,
      _cashier: '═══ ИТОГО ═══'
    });
    result.push(overallRow);
  }
  
  return result;
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

if (typeof self !== 'undefined' && self.importScripts) {
  self.processData = processData;
  self.groupData = groupData;
  self.round2 = round2;
  self.extractCashierId = extractCashierId;
  self.buildCashierToAgentMapping = buildCashierToAgentMapping;
  self.findSimilarNamesInData = findSimilarNamesInData;
  self.calculateNameSimilarity = calculateNameSimilarity;
  self.levenshteinDistance = levenshteinDistance;
}
