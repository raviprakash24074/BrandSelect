const { NlpManager } = require("node-nlp");

class QueryAnalyzer {
  constructor() {
    this.nlpProcessor = new NlpManager({ languages: ["en"] });
    this.brandKeywords = {
      van_heusen: ["van heusen", "vanheusen", "van", "Van Heusen"],
      Peter_England: ["peter england", "peterengland", "peter", "Peter_England"],
    };
    this.categoryKeywords = {
      Jeans: ["jeans", "denim", "pants", "Jeans", "JEANS", "jean"],
      Shirts: ["shirt", "top", "Shirts", "SHIRTS", "shirts"],
      tShirts: ["t-shirt", "tshirt", "T-Shirts", "TSHIRTS", "t-shirts"],
      Jackets: ["jacket", "coat", "blazer", "hoodie", "Jackets", "JACKET"],
    };
  }

  async analyzeQueryPayload(queryPayload) {
  
    return queryPayload.map(({ query, filters }) => {
      if (!query || typeof query !== "string") {
        throw new Error("Invalid query input. Query must be a non-empty string.");
      }

      return {
        query,
        filters: this.extractFilters(filters),
        brands: this.extractBrands(query),
        categories: this.extractCategories(query),
      };
    });
  }

  extractBrands(query) {
    const brands = [];
    const lowercaseQuery = query.toLowerCase();

    for (const [brand, keywords] of Object.entries(this.brandKeywords)) {
      if (keywords.some((keyword) => lowercaseQuery.includes(keyword))) {
        brands.push(brand);
      }
    }
    return brands;
  }

  extractCategories(query) {
    const categories = [];
    const lowercaseQuery = query.toLowerCase();

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      if (keywords.some((keyword) => lowercaseQuery.includes(keyword))) {
        categories.push(category);
      }
    }
    return categories;
  }

  extractFilters(filters) {
    const defaultFilters = { size: [], color: [], stock: null };
    if (!filters || typeof filters !== "object") {
      return defaultFilters;
    }

    return {
      size: filters.size ? [filters.size] : [],
      color: filters.color ? [filters.color] : [],
      stock: filters.stock || null,
    };
  }
}

module.exports = QueryAnalyzer;











