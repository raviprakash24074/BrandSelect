// src/services/SchemaMapper.js
const SemanticMatcher = require('../utils/semanticMatcher');

class SchemaMapper {
  constructor() {
    this.semanticMatcher = new SemanticMatcher();
    this.unifiedSchema = [
      'Id',
      'name',
      'category',
      'size',
      'stock',
      'color',
      'price',
      'description'
    ];
  }

  async mapSchema(sourceSchema, sourceType) {
    const mappings = new Map();
    const errors = [];

    for (const sourceField of sourceSchema) {
      try {
        const unifiedField = await this.semanticMatcher.mapField(
          sourceField,
          this.unifiedSchema
        );
        mappings.set(sourceField, unifiedField);
      } catch (error) {
        errors.push({
          field: sourceField,
          error: error.message
        });
      }
    }

    return {
      sourceType,
      mappings: Object.fromEntries(mappings),
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async transformData(data, mappings) {
    return data.map(record => {
      const transformedRecord = {};
      for (const [sourceField, unifiedField] of Object.entries(mappings)) {
        if (record[sourceField] !== undefined) {
          transformedRecord[unifiedField] = record[sourceField];
        }
      }
      return transformedRecord;
    });
  }
}

module.exports = SchemaMapper;
