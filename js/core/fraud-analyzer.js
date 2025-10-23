'use strict';

function analyzeFraud(data, cashierColumn, fraudConfig = {}, cashierToAgent = {}) {
  console.log('[Fraud Analyzer] Анализ', data.length, 'строк');
  console.log('[Fraud Analyzer] Config:', fraudConfig);
  console.log('[Fraud Analyzer] Маппинг получен:', Object.keys(cashierToAgent).length, 'записей');
  
  const CONFIG = {
    MIN_WITHDRAWAL_DIFF: fraudConfig.MIN_WITHDRAWAL_DIFF || 100,
    MEDIUM_RATIO: fraudConfig.MEDIUM_RATIO || 1.1,
    HIGH_RATIO: fraudConfig.HIGH_RATIO || 2.0,
    HIGH_DIFF: fraudConfig.HIGH_DIFF || 1000,
    MIN_AMOUNT_FOR_ANALYSIS: fraudConfig.MIN_AMOUNT_FOR_ANALYSIS || 100,
    EMPTY_ACCOUNT_THRESHOLD: fraudConfig.EMPTY_ACCOUNT_THRESHOLD || 10,
    NAME_SIMILARITY_THRESHOLD: fraudConfig.NAME_SIMILARITY_THRESHOLD || 0.7,
    MULTI_ACCOUNT_THRESHOLD: fraudConfig.MULTI_ACCOUNT_THRESHOLD || 3,
    MULTI_ACCOUNT_LOW_LOSS: fraudConfig.MULTI_ACCOUNT_LOW_LOSS || 75,
    MULTI_ACCOUNT_MEDIUM_LOSS: fraudConfig.MULTI_ACCOUNT_MEDIUM_LOSS || 150,
    MULTI_ACCOUNT_MEDIUM_COUNT: fraudConfig.MULTI_ACCOUNT_MEDIUM_COUNT || 5,
    MULTI_ACCOUNT_HIGH_LOSS: fraudConfig.MULTI_ACCOUNT_HIGH_LOSS || 500,
    MULTI_ACCOUNT_HIGH_COUNT: fraudConfig.MULTI_ACCOUNT_HIGH_COUNT || 10,
    NAME_SIMILARITY_MULTI: fraudConfig.NAME_SIMILARITY_MULTI || 0.8
  };
  
  const fraudCases = [];
  const headers = Object.keys(data[0]);
  const cashierKey = headers[cashierColumn];
  
  console.log('[Fraud] Примеры маппинга:', Object.entries(cashierToAgent).slice(0, 5));
  
  const players = preparePlayersData(data, headers, cashierKey);
  
  // НОВАЯ ЛОГИКА HIGH_WITHDRAWALS
  players.forEach(player => {
    const diff = player.withdrawals - player.deposits;
    
    // Пропускаем если разница меньше MIN_WITHDRAWAL_DIFF
    if (diff <= CONFIG.MIN_WITHDRAWAL_DIFF) return;
    
    let severity = null;
    let details = '';
    
    if (player.deposits === 0) {
      // Случай с нулевым депозитом
      if (player.withdrawals >= CONFIG.HIGH_DIFF) {
        severity = 'HIGH';
      } else {
        severity = 'MEDIUM';
      }
      details = `Вывод $${Math.round(player.withdrawals)} без депозита`;
    } else {
      // Случай с ненулевым депозитом
      const ratio = player.withdrawals / player.deposits;
      
      if (ratio >= CONFIG.HIGH_RATIO || diff >= CONFIG.HIGH_DIFF) {
        severity = 'HIGH';
      } else if (ratio >= CONFIG.MEDIUM_RATIO) {
        severity = 'MEDIUM';
      } else {
        return; // Пропускаем
      }
      
      const ratioPercent = Math.round(ratio * 100);
      details = `Выводов ко вводам: ${ratioPercent}%. Депозит: $${Math.round(player.deposits)}, Вывод: $${Math.round(player.withdrawals)}`;
    }
    
    // Если severity определен, добавляем в fraudCases
    if (severity) {
      const agentName = cashierToAgent[player.cashierId] || 
                       cashierToAgent[player.cashierName] ||
                       'Неизвестный агент';
      
      fraudCases.push({
        type: 'HIGH_WITHDRAWALS',
        severity,
        playerId: player.id,
        playerName: player.name,
        cashiers: [player.cashierName],
        details,
        agentName
      });
    }
  });
  
  const cashiers = {};
  players.forEach(p => {
    if (!cashiers[p.cashierId]) {
      const agentName = cashierToAgent[p.cashierId] || 
                       cashierToAgent[p.cashierName] ||
                       null;
      cashiers[p.cashierId] = {
        id: p.cashierId,
        name: p.cashierName,
        players: [],
        agentName: agentName
      };
    }
    cashiers[p.cashierId].players.push(p);
  });
  
  players.forEach(player => {
    const agentName = cashierToAgent[player.cashierId] || 
                     cashierToAgent[player.cashierName];
    if (!agentName) return;
    
    const similarity = calculateNameSimilarity(agentName, player.name);
    
    if (similarity > CONFIG.NAME_SIMILARITY_THRESHOLD) {
      fraudCases.push({
        type: 'AGENT_SELF_PLAY',
        severity: 'HIGH',
        playerId: player.id,
        playerName: player.name,
        cashiers: [player.cashierName],
        details: `Возможно, агент играет. Похожие имена: '${agentName}' и '${player.name}'`,
        agentName
      });
    }
  });
  
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
  
  Object.values(cashiers).forEach(cashier => {
    const trashAccounts = cashier.players.filter(p => p.name && isTrashName(p.name));
    
    if (trashAccounts.length >= CONFIG.EMPTY_ACCOUNT_THRESHOLD) {
      const severity = trashAccounts.length >= 200 ? 'HIGH' : 
                      trashAccounts.length >= 50 ? 'MEDIUM' : 'LOW';
      const examples = trashAccounts.slice(0, 3).map(p => `${p.id} (${p.name})`).join(', ');
      
      fraudCases.push({
        type: 'TRASH_ACCOUNTS',
        severity,
        playerId: trashAccounts[0].id || '',
        playerName: '',
        cashiers: [cashier.name],
        details: `${trashAccounts.length} аккаунтов с мусорными именами. Примеры: ${examples}`,
        agentName: cashier.agentName
      });
    }
  });
  
  Object.values(cashiers).forEach(cashier => {
    detectMultiAccounts(cashier, cashier.players, CONFIG, fraudCases);
  });
  
  console.log('[Fraud Analyzer] Найдено случаев:', fraudCases.length);
  return fraudCases;
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

function detectMultiAccounts(cashier, playersOnCashier, CONFIG, fraudCases) {
  const clusters = [];
  const processed = new Set();
  
  playersOnCashier.forEach((player, index) => {
    if (processed.has(index) || !player.name) return;
    
    const cluster = [player];
    processed.add(index);
    
    playersOnCashier.forEach((otherPlayer, otherIndex) => {
      if (processed.has(otherIndex) || index === otherIndex || !otherPlayer.name) return;
      
      const similarity = calculateNameSimilarity(player.name, otherPlayer.name);
      
      if (similarity > CONFIG.NAME_SIMILARITY_MULTI) {
        cluster.push(otherPlayer);
        processed.add(otherIndex);
      }
    });
    
    if (cluster.length >= CONFIG.MULTI_ACCOUNT_THRESHOLD) {
      clusters.push(cluster);
    }
  });
  
  clusters.forEach(cluster => {
    const lossyAccounts = cluster.filter(p => (p.deposits - p.withdrawals) < 0);
    
    if (lossyAccounts.length < CONFIG.MULTI_ACCOUNT_THRESHOLD) return;
    
    const totalLoss = lossyAccounts.reduce((sum, p) => sum + (p.deposits - p.withdrawals), 0);
    
    let severity = 'LOW';
    if (totalLoss < -CONFIG.MULTI_ACCOUNT_HIGH_LOSS && 
        lossyAccounts.length >= CONFIG.MULTI_ACCOUNT_HIGH_COUNT) {
      severity = 'HIGH';
    } else if (totalLoss < -CONFIG.MULTI_ACCOUNT_MEDIUM_LOSS && 
               lossyAccounts.length >= CONFIG.MULTI_ACCOUNT_MEDIUM_COUNT) {
      severity = 'MEDIUM';
    } else if (totalLoss < -CONFIG.MULTI_ACCOUNT_LOW_LOSS && 
               lossyAccounts.length >= CONFIG.MULTI_ACCOUNT_THRESHOLD) {
      severity = 'LOW';
    } else {
      return;
    }
    
    lossyAccounts.sort((a, b) => (a.deposits - a.withdrawals) - (b.deposits - b.withdrawals));
    
    const mostLossy = lossyAccounts[0];
    const examples = lossyAccounts.slice(0, 5).map(p => 
      `${p.id} (${p.name || 'без имени'}, -$${Math.abs(Math.round(p.deposits - p.withdrawals))})`
    ).join(', ');
    
    fraudCases.push({
      type: 'MULTI_ACCOUNTS',
      severity: severity,
      playerId: mostLossy.id,
      playerName: mostLossy.name,
      cashiers: [cashier.name],
      details: `${lossyAccounts.length} убыточных мультов. Примеры: ${examples}. Общий убыток: -$${Math.abs(Math.round(totalLoss))}`,
      agentName: cashier.agentName
    });
  });
}

function isTrashName(name) {
  if (!name || name.length < 3) return true;

  const digitRatio = (name.match(/\d/g) || []).length / name.length;
  if (digitRatio > 0.4) return true;

  const uniqueChars = new Set(name.toLowerCase()).size;
  if (uniqueChars / name.length < 0.5 && name.length > 4) return true;

  const vowels = (name.match(/[aeiouаеёиоуыэюя]/gi) || []).length;

  if (/^[a-z]+$/i.test(name) || /^[а-яё]+$/i.test(name)) {
    if (vowels === 0) return true;
  }

  if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(name) ||
      /[бвгджзйклмнпрстфхцчшщ]{4,}/i.test(name)) {
    return true;
  }

  return false;
}

function extractCashierId(cashierStr) {
  const match = String(cashierStr).match(/(\d+)[,\s]/);
  return match ? match[1] : cashierStr;
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

if (typeof self !== 'undefined' && self.importScripts) {
  self.analyzeFraud = analyzeFraud;
}
