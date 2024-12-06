const DataIntegrationService = require("./dataIntegration");
const ResultAggregator = require("./resultAggregator");
const DatabaseConnections = require("../config/db.connections");

class QueryFederation {
  constructor(connections, queryAnalyzer, queryDecomposer) {
    this.connections = connections;
    this.queryAnalyzer = queryAnalyzer;
    this.queryDecomposer = queryDecomposer;
    
    this.dataIntegration = new DataIntegrationService(connections);
    this.resultAggregator = new ResultAggregator();
  }

  async executeQuery(queryPayload) {
    const analysisResults = await this.queryAnalyzer.analyzeQueryPayload(
      queryPayload
    );
    console.log('query',...analysisResults);
    const subQueries = await Promise.all(
      analysisResults.map((analysis) =>
        this.queryDecomposer.decomposeQuery(analysis)
      )
    );
    console.log('subQueries',subQueries);
    const results = [];
    const dbStatus = DatabaseConnections.getStatus();
    // const results = await Promise.all(
    //   subQueries.flat().map((subQuery) => this.executeSubQuery(subQuery))
    // );
    // console.log("Results--->",results)
    // for (const subQuery of subQueries.flat()) {
    //   if (dbStatus[subQuery.brand]) {
    //     try {
    //       const result = await this.executeSubQuery(subQuery);
    //       results.push(...result);
    //     } catch (error) {
    //       console.error(
    //         `Error executing query for brand ${subQuery.brand}:`,
    //         error
    //       );
    //     }
    //   } else {
    //     console.warn(
    //       `Skipping query for brand ${subQuery.brand}: DB unavailable`
    //     );
    //   }
    // }
    for (const subQuery of subQueries.flat()) {
      if (dbStatus[subQuery.brand] && this.connections.getMetadata().metadata[subQuery.brand]?.schema) {
        try {
          console.log("Skipping query for brand",subQuery)
          const result = await this.executeSubQuery(subQuery);
          results.push(...result);
        } catch (error) {
          console.error(`Error executing query for brand ${subQuery.brand}:`, error);
        }
      } else {
        console.warn(`Skipping query for brand ${subQuery.brand}: No schema or DB unavailable`);
      }
    }

    // if (results.length === 0) {
    //   throw new Error(
    //     "No results found. Check your query or database availability."
    //   );
    // }
    return this.resultAggregator.aggregateResults(results.flat());
  }

  async executeSubQuery({ brand, query }) {
    const connection = this.connections.getConnection(brand);
    if (!connection) {
      throw new Error(`No connection available for brand: ${brand}`);
    }

    if (brand === "van_heusen") {
      return this.executeMySQL(connection, query);
    }
    if (brand === "Peter_England") {
      return this.executeMongoDB(connection, query);
    }
    throw new Error(`Unsupported brand: ${brand}`);
  }

  async executeMySQL(connection, query) {
    const [rows] = await connection.execute(query.sql, query.params);
    return rows.map((row) => ({ id: row.product_id,...row, Brand: "Van Heusen" }));
  }

  async executeMongoDB(connection, query) {
    console.log('1');
    const results = await connection.db
      .collection("Items")
      .find(query)
      .toArray();
    
    return results.map((item) => ({ id: item._id,...item, Brand: "Peter England" }));
  }
}

module.exports = QueryFederation;
