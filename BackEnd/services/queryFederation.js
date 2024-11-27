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
    const analysisResults = await this.queryAnalyzer.analyzeQueryPayload(queryPayload);

    const subQueries = await Promise.all(
      analysisResults.map((analysis) => this.queryDecomposer.decomposeQuery(analysis))
    );

    const results = await Promise.all(
      subQueries.flat().map((subQuery) => this.executeSubQuery(subQuery))
    );
    console.log("Results--->",results)
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
    return rows.map((row) => ({ ...row, Brand: "Van Heusen" }));
  }

  async executeMongoDB(connection, query) {
    const results = await connection.db.collection("Items").find(query).toArray();
    return results.map((item) => ({ ...item, Brand: "Peter England" }));
  }
}

module.exports = QueryFederation;





