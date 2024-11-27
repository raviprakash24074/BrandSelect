// src/utils/SemanticMatcher.js
const StringSimilarity = require('./stringSimilarity');

class SemanticMatcher {
  constructor() {
    this.ontology = this.loadOntology();
    this.fieldMappingCache = new Map();
  }

  loadOntology() {
    const ontology = new Map();
    
    const concepts = {
      'price': {
        synonyms: new Set(['cost', 'rate', 'amount', 'price', 'item_price', 'product_price']),
        relationships: new Map([
          ['currency', new Set(['USD', 'EUR'])],
          ['type', new Set(['retail', 'wholesale'])]
        ])
      },
      'size': {
        synonyms: new Set(['dimension', 'measurement', 'size', 'item_size', 'product_size']),
        relationships: new Map([
          ['type', new Set(['numeric', 'letter'])],
          ['region', new Set(['US', 'EU', 'UK'])]
        ])
      },
      'color': {
        synonyms: new Set(['color', 'shade', 'hue', 'item_color', 'product_color']),
        relationships: new Map([
          ['type', new Set(['basic', 'pattern'])]
        ])
      },
      'name': {
        synonyms: new Set(['title', 'label', 'name', 'item_name', 'product_name']),
        relationships: new Map([
          ['type', new Set(['brand', 'model'])]
        ])
      },
      'description': {
        synonyms: new Set(['details', 'specs', 'description', 'item_description', 'product_description']),
        relationships: new Map([
          ['type', new Set(['short', 'long', 'technical'])]
        ])
      }
    };

    for (const [key, value] of Object.entries(concepts)) {
      ontology.set(key, value);
    }

    return ontology;
  }

  async getFieldSimilarity(field1, field2) {
    const cacheKey = `${field1}|${field2}`;
    if (this.fieldMappingCache.has(cacheKey)) {
      return this.fieldMappingCache.get(cacheKey);
    }

    const ontologyScore = this.getOntologySimilarity(field1, field2);
    
    let finalScore = ontologyScore;
    if (ontologyScore < 1) {
      const jaccardScore = StringSimilarity.getJaccardSimilarity(field1, field2);
      const levenshteinScore = StringSimilarity.getLevenshteinDistance(field1, field2);
      const ngramScore = StringSimilarity.getNGramSimilarity(field1, field2, 2);

      finalScore = Math.max(
        ontologyScore * 0.5 + 
        jaccardScore * 0.2 + 
        levenshteinScore * 0.2 + 
        ngramScore * 0.1,
        ontologyScore
      );
    }

    this.fieldMappingCache.set(cacheKey, finalScore);
    
    if (this.fieldMappingCache.size > 10000) {
      const keys = Array.from(this.fieldMappingCache.keys());
      for (let i = 0; i < 1000; i++) {
        this.fieldMappingCache.delete(keys[i]);
      }
    }

    return finalScore;
  }

  getOntologySimilarity(field1, field2) {
    // console.log("getOntologySimilarity", field1, field2);
    const norm1 = this.normalizeFieldName(field1);
    const norm2 = this.normalizeFieldName(field2);

    if (norm1 === norm2) return 1.0;

    for (const [, data] of this.ontology) {
      if (data.synonyms.has(norm1) && data.synonyms.has(norm2)) {
        return 1.0;
      }
    }

    return 0;
  }

  normalizeFieldName(field){
    const fieldString = String(field)
    // console.log("normalizeFieldName", field);
    return fieldString
      .toLowerCase()
      .replace(/[_-]/g, ' ')
  }

  async mapField(sourceField, targetSchema) {
    
    const batchSize = 100;
    const results = new Map();
    
    for (let i = 0; i < targetSchema.length; i += batchSize) {
      const batch = targetSchema.slice(i, i + batchSize);
      const similarities = await Promise.all(
        batch.map(targetField => this.getFieldSimilarity(sourceField, targetField))
      );
      
      for (let j = 0; j < batch.length; j++) {
        results.set(batch[j], similarities[j]);
      }
    }

    let bestMatch = null;
    let maxScore = 0;
    
    for (const [field, score] of results) {
      if (score > maxScore) {
        maxScore = score;
        bestMatch = field;
      }
    }
    console.log(maxScore,bestMatch,sourceField)
    return maxScore > 0.10 ? bestMatch : sourceField;
  }
}

module.exports = SemanticMatcher;