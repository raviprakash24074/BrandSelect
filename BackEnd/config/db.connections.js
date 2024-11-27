
const { createMySQLConnection, vanHeusenConfig } = require('../config/mysql.config');
const { createMongoConnection, peterEnglandConfig } = require('../config/mongodb.config');
const SchemaMapper = require('../services/schemaMapper');
class DatabaseConnections {
  constructor() {
    this.connections = {};
    this.metadata = {
      [vanHeusenConfig.database]: {},
      [peterEnglandConfig.database]: {},
    };
    this.schemaMapper = new SchemaMapper();
    this.mappings = {};
    this.unifiedMappings = {};
    this.unifiedSchema = {};
  }

  async initialize() {
    try {
      await this.initializeVanHeusen();
      await this.initializePeterEngland();
      await this.generateSchemaMappings();

      console.log('All database connections established');
      console.log('Schema mappings generated:', this.mappings);

      this.unifiedMappings = this.generateUnifiedMapping();
      this.unifiedSchema = this.generateUnifiedSchema();

      // console.log('Unified Mapping:', this.unifiedMappings);
      // console.log('Unified Schema:', this.unifiedSchema);
    } catch (error) {
      console.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  async initializeVanHeusen() {
    const connection = await createMySQLConnection(vanHeusenConfig);
    this.connections.van_heusen = connection;

    const [tables] = await connection.query('SHOW TABLES');
    const dbName = vanHeusenConfig.database;
    this.metadata[dbName].tables = tables.map((row) => Object.values(row)[0]);
    this.metadata[dbName].schema = {};

    for (const table of this.metadata[dbName].tables) {
      const [columns] = await connection.query(`DESCRIBE ${table}`);
      this.metadata[dbName].schema[table] = columns.map((col) => col.Field);
    }
  }

  async initializePeterEngland() {
    const connection = await createMongoConnection();
    this.connections.Peter_England = connection;

    const dbName = peterEnglandConfig.database;
    const collections = await connection.db.listCollections().toArray();
    this.metadata[dbName].collections = collections.map((col) => col.name);
    this.metadata[dbName].schema = {};

    for (const collectionName of this.metadata[dbName].collections) {
      const sampleDoc = await connection.db.collection(collectionName).findOne();
      this.metadata[dbName].schema[collectionName] = sampleDoc
        ? Object.keys(sampleDoc).map((field) => field)
        : [];
    }
  }

  async generateSchemaMappings() {
    const vanHeusenFields =
      this.metadata[vanHeusenConfig.database].schema.products || [];
    const peterEnglandFields =
      this.metadata[peterEnglandConfig.database].schema.Items || [];

    this.mappings.van_heusen = await this.schemaMapper.mapSchema(
      vanHeusenFields.map((f) => f),
      'van_heusen'
    );

    this.mappings.Peter_England = await this.schemaMapper.mapSchema(
      peterEnglandFields.map((f) => f),
      'Peter_England'
    );
  }

  generateUnifiedMapping() {
    const unifiedMapping = {};

    for (const [key, schema] of Object.entries(this.mappings)) {
      unifiedMapping[key] = {};

      for (const [originalKey, unifiedKey] of Object.entries(schema.mappings)) {
        unifiedMapping[key][unifiedKey] = originalKey;
      }
    }

    return unifiedMapping;
  }

  generateUnifiedSchema() {
    const unifiedSchema = {
      name: [],
      category: [],
      price: [],
      size: [],
      color: [],
      stock: [],
    };

    for (const schema of Object.values(this.unifiedMappings)) {
      for (const [key, value] of Object.entries(schema)) {
        if (key in unifiedSchema) {
          unifiedSchema[key].push(value);
        }
      }
    }

    return unifiedSchema;
  }

  async transformData(data, sourceType) {
    return this.schemaMapper.transformData(
      data,
      this.mappings[sourceType].mappings
    );
  }

  getConnection(brand) {
    console.log('getconnection', brand);

    return this.connections[brand];
  }

  getMetadata() {
    return {
      metadata: this.metadata,
      mappings: this.mappings,
    };
  }
  getunifiedMappings(){
    return {
      unifiedMappings:this.unifiedMappings
    }
  }
  getunifiedSchema(){
    return {
      unifiedSchema:this.unifiedSchema
    }
  }
  async closeAll() {
    try {
      for (const [key, connection] of Object.entries(this.connections)) {
        if (key === 'vanHeusen') {
          await connection.end();
        } else if (key === 'peterEngland') {
          await connection.close();
        }
      }
      console.log('All database connections closed');
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
  }
}

module.exports = new DatabaseConnections();


