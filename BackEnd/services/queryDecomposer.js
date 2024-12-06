const DatabaseConnections = require("../config/db.connections");
const SemanticMatcher = require("../utils/semanticMatcher");
const matcher = new SemanticMatcher();

class QueryDecomposer {
    constructor(semanticMatcher) {
        this.semanticMatcher = semanticMatcher;
        this.metadata = DatabaseConnections.getMetadata().metadata;
    }

    async decomposeQuery(analysisResult) {
        const subQueries = [];
        const targetBrands =
            analysisResult.brands.length > 0
                ? analysisResult.brands
                : Object.keys(this.metadata);

        for (const brand of targetBrands) {
            const schema = this.getSchemaForBrand(brand);
            if (!schema) {
                console.warn(`No schema found for brand: ${brand}`);
                continue;
            }
            
            const mappedFilters = await this.mapFiltersToSchema(analysisResult.filters, schema);
            console.log("Mapped Filters:", mappedFilters);

            subQueries.push({
                brand,
                query: this.buildSourceQuery(brand, {
                    ...analysisResult,
                    filters: mappedFilters,
                }),
            });
        }
        return subQueries;
    }

    getSchemaForBrand(brand) {
        const brandSchema = this.metadata[brand]?.schema;
        if (!brandSchema) {
            console.warn(`No schema found for brand: ${brand}`);
            return null;
        }
        return brand === "van_heusen"
            ? this.metadata["van_heusen"].schema["products"]
            : this.metadata["Peter_England"].schema["Items"];
    }

    async mapFiltersToSchema(filters, schema) {
        console.log("Mapping Filters to Schema:", filters, schema);
        const mappedFilters = {};

        for (const [field, value] of Object.entries(filters)) {
            if (value && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0)) {
                const matchedField = await matcher.mapField(field, schema);
                console.log(`Field Mapping: ${field} -> ${matchedField}`);
                if (matchedField) {
                    mappedFilters[matchedField] = value;
                } else {
                    console.warn(`No matching field found for filter: ${field}`);
                }
            }
        }

        return mappedFilters;
    }

    buildSourceQuery(brand, analysis) {
        switch (brand) {
            case "van_heusen":
                return this.buildMySQLQuery(
                    this.metadata[brand].tables,
                    analysis,
                    this.metadata[brand].schema.products
                );
            case "Peter_England":
                return this.buildMongoQuery(analysis, this.metadata[brand].schema.Items);
            default:
                throw new Error(`Unknown brand: ${brand}`);
        }
    }

    buildMySQLQuery(table, analysis, schema) {
      
      const conditions = [];
      const params = [];
  
      // Handle categories
      if (analysis.categories.length > 0) {
          const categoryField = schema.find((field) => field.includes("category"));
          if (categoryField) {
              const placeholders = analysis.categories.map(() => "?").join(", ");
              conditions.push(`${categoryField} IN (${placeholders})`);
              params.push(...analysis.categories);
          }
      }
  
      // Handle filters dynamically
      for (const [field, value] of Object.entries(analysis.filters)) {
          const mappedField = schema.find((f) => f.includes(field));
          console.log(`MySQL Field Mapping: ${field} -> ${mappedField}`);
          if (mappedField) {
              if (value.min !== null && value.min !== undefined && value.min !== '') {
                  conditions.push(`${mappedField} >= ?`);
                  params.push(value.min);
              }
              if (value.max !== null && value.max !== undefined && value.max !== '') {
                  conditions.push(`${mappedField} <= ?`);
                  params.push(value.max);
              } else if (Array.isArray(value) && value.length > 0) {
                  const placeholders = value.map(() => "?").join(", ");
                  conditions.push(`${mappedField} IN (${placeholders})`);
                  params.push(...value);
              }
          }
      }
  
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  
      console.log("Generated SQL Query:", `SELECT * FROM ${table} ${whereClause}`);
      console.log("Query Parameters:", params);
  
      return {
          sql: `SELECT * FROM ${table} ${whereClause}`,
          params,
      };
  }
  

    buildMongoQuery(analysis, schema) {
        const query = {};

        // Handle categories
        if (analysis.categories.length > 0) {
            query.item_category = {
                $in: analysis.categories.map((category) => new RegExp(`^${category}$`, "i")),
            };
        }

        // Handle filters dynamically
        for (const [field, value] of Object.entries(analysis.filters)) {
            const mappedField = schema.find((f) => f.includes(field));
           
            if (mappedField) {
                
                if (value.min !== null && value.min !== undefined && value.min !== '') {
                    query[mappedField].$gte = Number(value.min);
                }
                if (value.max !== null && value.max !== undefined && value.max !== '') {
                    query[mappedField].$lte = Number(value.max);
                } else if (Array.isArray(value) && value.length > 0) {
                    query[mappedField] = {
                        $in: value.map((v) => new RegExp(`^${v}$`, "i")),
                    };
                }
            }
        }

        return query;
    }
}

module.exports = QueryDecomposer;

























// const DatabaseConnections = require("../config/db.connections");
// const SemanticMatcher = require("../utils/semanticMatcher");
// const matcher = new SemanticMatcher();

// class QueryDecomposer {
//   constructor(semanticMatcher) {
//     this.semanticMatcher = semanticMatcher;
//     this.metadata = DatabaseConnections.getMetadata().metadata;
//   }

//   async decomposeQuery(analysisResult) {
//     const subQueries = [];
//     const targetBrands =
//       analysisResult.brands.length > 0
//         ? analysisResult.brands
//         : Object.keys(this.metadata);

//     for (const brand of targetBrands) {
//       const schema = this.getSchemaForBrand(brand);
//       if (!schema) {
//         console.warn(`No schema found for brand: ${brand}`);
//         continue;
//       }
//       console.log('22222222222222',analysisResult.filters)
//       const mappedFilters = await this.mapFiltersToSchema(analysisResult.filters,schema);
//       console.log('333333333',mappedFilters)
//       subQueries.push({
//         brand,
//         query: this.buildSourceQuery(brand, {
//           ...analysisResult,
//           filters: mappedFilters,
//         }),
//       });
//     }
//     return subQueries;
//   }

//   getSchemaForBrand(brand) {
//     const brandSchema = this.metadata[brand]?.schema;
//     if (!brandSchema) {
//       console.warn(`No schema found for brand: ${brand}`);
//       return null;
//     }
//     if (brand === "van_heusen") {
//       return this.metadata["van_heusen"].schema["products"];
//     } else if (brand === "Peter_England") {
//       return this.metadata["Peter_England"].schema["Items"];
//     }
//     return null;
//   }

//   async mapFiltersToSchema(filters, schema) {
//     console.log("mapFiltersToSchema",filters,schema);
//     const mappedFilters = {};
//     for (const [field, value] of Object.entries(filters)) {
//       if (value && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0)) {
//         // if (value && value.length > 0) {
//         const matchedField = await matcher.mapField(field, schema);
//         if (matchedField) {
//           mappedFilters[matchedField] = value;
//         } else {
//           console.warn(`No matching field found for filter: ${field}`);
//         }
//       }
//     }
//     return mappedFilters;
//   }

//   buildSourceQuery(brand, analysis) {
//     switch (brand) {
//       case "van_heusen":
//         return this.buildMySQLQuery(
//           this.metadata[brand].tables,
//           analysis,
//           this.metadata[brand].schema.products
//         );
//       case "Peter_England":
//         return this.buildMongoQuery(analysis, this.metadata[brand].schema.Items);
//       default:
//         throw new Error(`Unknown brand: ${brand}`);
//     }
//   }

//   // buildMySQLQuery(table, analysis, schema) {
//   //   const conditions = [];
//   //   const params = [];

//   //   if (analysis.categories.length > 0) {
//   //     const categoryField = schema.find((field) => field.includes("category"));
//   //     const placeholders = analysis.categories.map(() => "?").join(", ");
//   //     conditions.push(`${categoryField} IN (${placeholders})`);
//   //     params.push(...analysis.categories);
//   //   }

//   //   for (const [field, value] of Object.entries(analysis.filters)) {
//   //     if (value && value.length > 0) {
//   //       const mappedField = schema.find((f) => f.includes(field));
//   //       if (mappedField) {
//   //         const placeholders = value.map(() => "?").join(", ");
//   //         conditions.push(`${mappedField} IN (${placeholders})`);
//   //         params.push(...value);
//   //       }
//   //     }
//   //   }

//   //   const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

//   //   return {
//   //     sql: `SELECT * FROM ${table} ${whereClause}`,
//   //     params,
//   //   };
//   // }
//   buildMySQLQuery(table, analysis, schema) {
//     console.log("mysql",table,analysis,schema)
//     const conditions = [];
//     const params = [];
  
//     // Handle categories
//     if (analysis.categories.length > 0) {
//       const categoryField = schema.find((field) => field.includes("category"));
//       if (categoryField) {
//         const placeholders = analysis.categories.map(() => "?").join(", ");
//         conditions.push(`${categoryField} IN (${placeholders})`);
//         params.push(...analysis.categories);
//       }
//     }
//     console.log(analysis.filters.product_price,"yyyyyyyyyyyyyyyyyyyy");
//     // Handle filters, including price
//     for (const [field, value] of Object.entries(analysis.filters)) {
//       const mappedField = schema.find((f) => f.includes(field)); // Use schema map
//       console.log(mappedField);
//       if (mappedField) {
//         if (field === "price") {
//           // Handle price range specifically
//           console.Consolelog('11111',field);
//           if (value.min !== null && value.min !== undefined) {
//             conditions.push(`${mappedField} >= ?`);
//             params.push(value.min);
//           }
//           if (value.max !== null && value.max !== undefined) {
//             conditions.push(`${mappedField} <= ?`);
//             params.push(value.max);
//           }
//         } else if (Array.isArray(value) && value.length > 0) {
//           // Handle other array filters
//           const placeholders = value.map(() => "?").join(", ");
//           conditions.push(`${mappedField} IN (${placeholders})`);
//           params.push(...value);
//         }
//       }
//     }
  
//     const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  
//     return {
//       sql: `SELECT * FROM ${table} ${whereClause}`,
//       params,
//     };
//   }


//   buildMongoQuery(analysis, schema) {
//     const query = {};
  
//     // Handle categories
//     if (analysis.categories.length > 0) {
//       query.item_category = {
//         $in: analysis.categories.map(
//           (category) => new RegExp(`^${category}$`, "i")
//         ),
//       };
//     }
  
//     // Handle filters, including price
//     for (const [field, value] of Object.entries(analysis.filters)) {
//       console.log(field,value,"hiiiiiiiiiiiiiiiiiiiiiii")
//       const mappedField = schema.find((f) => f.includes(field)); // Use schema map
//       console.log("Mapping",mappedField)
//       if (mappedField) {
//         console.log("11111111/",field);
//         // if (field === "price") {
//         //   // Handle price range specifically
//         //   if (value.min !== null && value.min !== undefined) {
//         //     query[mappedField] = { ...query[mappedField], $gte: value.min };
//         //   }
//         //   if (value.max !== null && value.max !== undefined) {
//         //     query[mappedField] = { ...query[mappedField], $lte: value.max };
//         //   }
//         if (field === "price") {
//           console.log('hiii')
//           // Handle price range specifically
//           query[mappedField] = query[mappedField] || {};
//           if (value.min !== null && value.min !== undefined) {
//               query[mappedField].$gte = Number(value.min);
//           }
//           if (value.max !== null && value.max !== undefined) {
//               query[mappedField].$lte = Number(value.max);
//           }
//         } else if (Array.isArray(value) && value.length > 0) {
//           // Handle other array filters
//           console.log('inside mongo query')
//           query[mappedField] = {
//             $in: value.map((v) => new RegExp(`^${v}$`, "i")),
//           };
//         }
//       }
//     }
  
//     return query;
//   }
  
// }


// module.exports = QueryDecomposer;



//   buildMongoQuery(analysis, schema) {
//     const query = {};

//     if (analysis.categories.length > 0) {
//       query.item_category = {
//         $in: analysis.categories.map(
//           (category) => new RegExp(`^${category}$`, "i")
//         ),
//       };
//     }

//     for (const [field, value] of Object.entries(analysis.filters)) {
//       if (value && value.length > 0) {
//         const mappedField = schema.find((f) => f.includes(field));
//         if (mappedField) {
//           query[mappedField] = {
//             $in: value.map((v) => new RegExp(`^${v}$`, "i")),
//           };
//         }
//       }
//     }

//     return query;
//   }
// }



