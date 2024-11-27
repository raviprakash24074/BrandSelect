// src/utils/StringSimilarity.js
class StringSimilarity {
  static similarityCache = new Map();
  
  static getCacheKey(str1, str2, algorithm) {
    return `${str1}|${str2}|${algorithm}`;
  }

  static getFromCache(str1, str2, algorithm) {
    const key = this.getCacheKey(str1, str2, algorithm);
    return this.similarityCache.get(key);
  }

  static setInCache(str1, str2, algorithm, value) {
    const key = this.getCacheKey(str1, str2, algorithm);
    this.similarityCache.set(key, value);
    
    if (this.similarityCache.size > 10000) {
      const keys = Array.from(this.similarityCache.keys());
      for (let i = 0; i < 1000; i++) {
        this.similarityCache.delete(keys[i]);
      }
    }
  }

  static getJaccardSimilarity(str1, str2) {
    const cached = this.getFromCache(str1, str2, 'jaccard');
    if (cached !== undefined) return cached;

    const getBigrams = str => {
      const bigrams = new Set();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.slice(i, i + 2));
      }
      return bigrams;
    };
    

    const set1 = getBigrams(str1.toLowerCase());
    const set2 = getBigrams(str2.toLowerCase());
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    const result = intersection.size / union.size;
    this.setInCache(str1, str2, 'jaccard', result);
    return result;
  }

  static getLevenshteinDistance(str1, str2) {
    const cached = this.getFromCache(str1, str2, 'levenshtein');
    if (cached !== undefined) return cached;

    if (str1 === str2) return 1;
    if (!str1.length || !str2.length) return 0;

    const rows = str1.length + 1;
    const cols = str2.length + 1;
    const matrix = Array(2).fill(null).map(() => Array(cols).fill(0));

    for (let i = 0; i < cols; i++) matrix[0][i] = i;
    
    let currentRow = 1;
    for (let i = 1; i < rows; i++) {
      matrix[currentRow][0] = i;
      
      for (let j = 1; j < cols; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[currentRow][j] = Math.min(
          matrix[currentRow][j - 1] + 1,
          matrix[1 - currentRow][j] + 1,
          matrix[1 - currentRow][j - 1] + cost
        );
      }
      
      currentRow = 1 - currentRow;
    }

    const result = 1 - (matrix[1 - currentRow][cols - 1] / Math.max(str1.length, str2.length));
    this.setInCache(str1, str2, 'levenshtein', result);
    return result;
  }

  static getNGramSimilarity(str1, str2, n = 2) {
    const cached = this.getFromCache(str1, str2, `ngram${n}`);
    if (cached !== undefined) return cached;

    const getNGrams = str => {
      const ngrams = new Set();
      for (let i = 0; i <= str.length - n; i++) {
        ngrams.add(str.slice(i, i + n));
      }
      return ngrams;
    };

    const set1 = getNGrams(str1.toLowerCase());
    const set2 = getNGrams(str2.toLowerCase());
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const result = intersection.size / Math.max(set1.size, set2.size);
    
    this.setInCache(str1, str2, `ngram${n}`, result);
    return result;
  }
}

module.exports = StringSimilarity;