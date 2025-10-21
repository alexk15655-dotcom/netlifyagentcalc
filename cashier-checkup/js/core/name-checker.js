'use strict';

/**
 * Проверяет похожие имена и мультиаккаунты
 * Портировано из NameChecker класса в .gs файле
 */
function checkNames(data) {
  console.log('[Name Checker] Проверка', data.length, 'строк');
  
  const SIMILARITY_THRESHOLD = 0.80;
  const MIN_NAME_LENGTH = 5;
  
  const results = new Map();
  const headers = Object.keys(data[0]);
  
  // Находим колонки ID, Name, Cashier
  const idKey = headers.find(h => h.includes('игрока') || h.includes('Номер'));
  const nameKey = headers.find(h => h === 'Игрок' || h.includes('Имя'));
  const cashierKey = data[0]._cashierColumn;
  
  if (!idKey || !nameKey) {
    console.warn('[Name Checker] Не найдены колонки ID или Name');
    return [];
  }
  
  // Проверяем каждую пару строк
  for (let i = 0; i < data.length; i++) {
    const row1 = data[i];
    const name1 = String(row1[nameKey] || '').trim();
    
    // Пропускаем пустые, ФГ и Итого
    if (!name1 || row1._isFG || row1._isOverall) continue;
    
    const id1 = String(row1[idKey] || '').trim();
    const cashier1 = String(row1[cashierKey] || '').trim();
    const normalized1 = normalizeName(name1);
    
    for (let j = i + 1; j < data.length; j++) {
      const row2 = data[j];
      const name2 = String(row2[nameKey] || '').trim();
      
      if (!name2 || row2._isFG || row2._isOverall) continue;
      
      const id2 = String(row2[idKey] || '').trim();
      const cashier2 = String(row2[cashierKey] || '').trim();
      const normalized2 = normalizeName(name2);
      
      const similarity = calculateSimilarity(normalized1, normalized2, MIN_NAME_LENGTH);
      
      if (similarity > SIMILARITY_THRESHOLD) {
        // Записываем для обеих строк
        recordSimilarity(results, i, id1, id2, cashier1, cashier2);
        recordSimilarity(results, j, id2, id1, cashier2, cashier1);
      }
    }
  }
  
  // Формируем результат
  const output = [];
  results.forEach((result, rowIndex) => {
    const row = data[rowIndex];
    output.push({
      index: rowIndex,
      id: row[idKey],
      name: row[nameKey],
      cashier: row[cashierKey],
      similarIds: Array.from(result.diffIds).join(', '),
      otherCashiers: Array.from(result.cashiers).join(', ')
    });
  });
  
  console.log('[Name Checker] Найдено подозрительных:', output.length);
  return output;
}

function recordSimilarity(results, rowIndex, currentId, otherId, currentCashier, otherCashier) {
  if (!results.has(rowIndex)) {
    results.set(rowIndex, { diffIds: new Set(), cashiers: new Set() });
  }
  
  const result = results.get(rowIndex);
  
  if (currentId === otherId) {
    // Тот же ID, разные кассы
    result.cashiers.add(otherCashier);
  } else {
    // Разные ID, похожие имена
    result.diffIds.add(otherId);
  }
}

function normalizeName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

function calculateSimilarity(str1, str2, minLength) {
  if (str1.length <= minLength || str2.length <= minLength) {
    return str1 === str2 ? 1 : 0;
  }
  
  if (str1 === str2) return 1;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  const longerLength = longer.length;
  
  if (longerLength === 0) return 1;
  
  const distance = levenshteinDistance(shorter, longer);
  return (longerLength - distance) / longerLength;
}

function levenshteinDistance(str1, str2) {
  const matrix = Array(str1.length + 1).fill(null)
    .map(() => Array(str2.length + 1).fill(null));
  
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

// Экспорт для Web Worker
if (typeof self !== 'undefined' && self.importScripts) {
  self.checkNames = checkNames;
}
