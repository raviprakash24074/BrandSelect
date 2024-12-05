// backend/services/resultAggregator.js
const DatabaseConnections = require("../config/db.connections");
class ResultAggregator {
    constructor() {
      this.unifiedSchema = DatabaseConnections.getunifiedSchema().unifiedSchema;
      
    }
  
    aggregateResults(results) {
      const aggregatedResults = [];
      for (const result of results) {
        const normalized = this.normalizeResult(result);
        aggregatedResults.push(normalized);
      }
      
      return this.deduplicateResults(aggregatedResults);
    }
  
    normalizeResult(result) {
      const normalized = {};
      for (const [unifiedField, sourceFields] of Object.entries(this.unifiedSchema)) {
        for (const sourceField of sourceFields) {
         
          if (result[sourceField] !== undefined) {
            normalized[unifiedField] = result[sourceField];
            break;
          }
        }
      }
      if(result["Brand"] !== undefined){
        normalized["Brand"]=result["Brand"];
      }
      if(result["id"] !== undefined){
        normalized["id"]=result["id"];
      }
      
      return normalized;
    }
  
    deduplicateResults(results) {
      const uniqueResults = [];
      const seen = new Set();
  
      for (const result of results) {
        const key = JSON.stringify(result);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueResults.push(result);
        }
      }
  
      return uniqueResults;
    }
  }
  
  module.exports = ResultAggregator;
  