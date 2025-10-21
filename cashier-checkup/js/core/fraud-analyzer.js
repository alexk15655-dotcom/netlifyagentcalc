'use strict';

/**
 * Анализирует подозрительные паттерны
 * Портировано из FraudAnalyzer класса
 */
function analyzeFraud(data, cashierColumn, fraudConfig = {}) {
  console.log('[Fraud Analyzer] Анализ', data.length, 'строк');
  console.log('[Fraud Analyzer] Config:', fraudConfig);
  
  // Используем переданные константы или дефолтные
  const CONFIG = {
    HIGH_WITHDRAWAL_RATIO: fraudConfig.HIGH_WITHDRAWAL_RATIO || 1.1,
    MIN_AMOUNT_FOR_ANALYSIS: fraudConfig.MIN_AMOUNT_FOR_ANALYSIS || 100,
    EMPTY_ACCOUNT_THRESHOLD: fraudConfig.EMPTY_ACCOUNT_THRESHOLD || 10,
    NAME_SIMILARITY_THRESHOLD: fraudConfig.NAME_SIMILARITY_THRESHOLD || 0.7
  };
  
  console.log('[Fraud Analyzer] Используемые пороги:', CONFIG);
  
  const fraudCases = [];
  const headers = Object.keys(data[0]);
  const cashierKey = headers[cashierColumn];
  
  // Строим маппинг касса -> агент из строк ФГ
  const cashierToAgent = buildCashierToAgentMapping(data, headers);
  
  // Готовим данные игроков
  const players = preparePlayersData(data, headers, cashierKey);
  
  // Анализ 1: Высокие выводы
  players.forEach(player => {
    if (player.deposits < CONFIG.MIN_AMOUNT_FOR_ANALYSIS) return;
    
    const ratio = player.deposits > 0 ? player.withdrawals / player.deposits : 0;
    
    if (ratio > CONFIG.HIGH_WITHDRAWAL_RATIO) {
      const severity = player.deposits > 1000 && ratio > 1.5 ? 'HIGH' : 'MEDIUM';
      const agentName = cashierToAgent[player.cashierId] || 'Неизвестный агент';
      
      fraudCases.push({
        type: 'HIGH_WITHDRAWALS',
        severity,
        playerId: player.id,
        playerName: player.name,
        cashiers: [player.cashierName],
        details: `Выводов ко вводам: ${Math.round(ratio * 100)}%. Депозит: $${Math.round(player.deposits)}, Вывод: $${Math.round(player.withdrawals)}`,
        agentName
      });
    }
  });
  
  // Анализ 2: Группировка по кассам
  const cashiers = {};
  players.forEach(p => {
    if (!cashiers[p.cashierId]) {
      cashiers[p.cashierId] = {
        id: p.cashierId,
        name: p.cashierName,
        players: [],
        agentName: cashierToAgent[p.cashierId] || null
      };
    }
    cashiers[p.cashierId].players.push(p);
  });
  
  // Анализ 3: Пустые аккаунты
  Object.values(cashiers).forEach(cashier => {
    const emptyAccounts = cashier.players.filter(p => !p.name || p.name.trim() === '');
    
    if (emptyAccounts.length >= CONFIG.EMPTY_ACCOUNT_THRESHOLD) {
      const severity = emptyAccounts.length >= 200 ? 'HIGH' : 
                      emptyAccounts.length >= 50 ? 'MEDIUM' : 'LOW';
      const examples = emptyAccounts.slice(0, 5).map(p => p.id).join(', ');
      
      fraudCases.push({
        type: 'EMPTY_ACCOUNTS',
        severity,
        playerId: emptyAccounts[0].id || '',
        playerName: '',
        cashiers: [cashier.name],
        details: `${emptyAccounts.length} пустых аккаунтов. Примеры: ${examples}`,
        agentName: cashier.agentName
      });
    }
  });
  
  console.log('[Fraud Analyzer] Найдено случаев:', fraudCases.length);
  return fraudCases;
}

function buildCashierToAgentMapping(data, headers) {
  const mapping = {};
  
  data.forEach(row => {
    if (!row._isFG) return;
    
    // Ищем "ФГ: Имя" в первых двух колонках
    const col0 = String(row[headers[0]] || '');
    const col1 = String(row[headers[1]] || '');
    
    let agentName = null;
    let cashierInfo = null;
    
    if (col0.startsWith('ФГ:')) {
      // Берем всё после "ФГ:" и убираем пробелы
      agentName = col0.substring(3).trim();
      cashierInfo = col1;
    } else if (col1.startsWith('ФГ:')) {
      agentName = col1.substring(3).trim();
      cashierInfo = col0;
    }
    
    if (agentName && cashierInfo) {
      // Извлекаем ID кассы - берем первые цифры до запятой или пробела
      const cashierIdMatch = cashierInfo.match(/^(\d+)/);
      const cashierId = cashierIdMatch ? cashierIdMatch[1] : null;
      
      if (cashierId && agentName) {
        // Нормализуем форматы кассы
        const normalizedCashier = cashierInfo.replace(/^(\d+),\s*/, '$1 ');
        
        // Сохраняем все варианты
        mapping[cashierId] = agentName;
        mapping[cashierInfo] = agentName;
        mapping[normalizedCashier] = agentName;
        
        console.log('[Fraud] Маппинг:', cashierId, '→', agentName);
      }
    }
  });
  
  console.log('[Fraud] Построен маппинг для', Object.keys(mapping).length, 'касс');
  return mapping;
}

function preparePlayersData(data, headers, cashierKey) {
  const players = [];
  
  const idKey = headers.find(h => h.includes('игрока') || h.includes('Номер'));
  const nameKey = headers.find(h => h === 'Игрок');
  
  data.forEach(row => {
    if (row._isFG || row._isOverall || row._separator) return;
    
    const cashier = String(row[cashierKey] || '').trim();
    if (!cashier) return;
    
    const cashierId = extractCashierId(cashier);
    
    const parseNum = (val) => parseFloat(String(val).replace(/[\s,]/g, '')) || 0;
    
    players.push({
      id: row[idKey] || '',
      name: row[nameKey] || '',
      cashierId: cashierId,
      cashierName: cashier,
      deposits: parseNum(row['Сумма пополнений (в валюте админа по курсу текущего дня)'] || 
                         row['Сумма пополнений (в валюте админа)'] || 0),
      withdrawals: parseNum(row['Сумма вывода (в валюте админа по курсу текущего дня)'] ||
                           row['Сумма вывода (в валюте админа)'] || 0)
    });
  });
  
  return players;
}

function extractCashierId(cashierStr) {
  const match = String(cashierStr).match(/(\d+)[,\s]/);
  return match ? match[1] : cashierStr;
}

// Экспорт для Web Worker
if (typeof self !== 'undefined' && self.importScripts) {
  self.analyzeFraud = analyzeFraud;
}
