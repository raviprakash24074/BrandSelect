
const { EventEmitter } = require('events');

class DataIntegrationService {
  constructor(connections) {
    this.connections = connections;
    this.materializedData = new Map();
    this.eventEmitter = new EventEmitter();
    this.volatileFields = ['size', 'stock'];
  }

  async initializeMaterializedView() {
    
    const data = await this.fetchAllProductData();
    this.materializedData = this.createMaterializedView(data);
    
   
    setInterval(() => this.refreshMaterializedView(), 24 * 60 * 60 * 1000); 
  }

  createMaterializedView(data) {
    const view = new Map();
    
    for (const item of data) {
      const key = `${item.brand}_${item.id}`;
     
      view.set(key, {
        name: item.name,
        category: item.category,
        color: item.color,
        description: item.description,
        price: item.price,
        brand: item.brand
      });
    }
    
    return view;
  }

  async getProductData(filters) {
  
    const materializedResults = this.getMaterializedData(filters);
    const virtualResults = await this.getVirtualData(filters);
    
    return this.mergeResults(materializedResults, virtualResults);
  }

  getMaterializedData(filters) {
 
    return Array.from(this.materializedData.values())
      .filter(item => this.matchesFilters(item, filters));
  }

  async getVirtualData(filters) {
    
    const results = [];
    
    for (const [brand, connection] of Object.entries(this.connections)) {
      const volatileData = await this.fetchVolatileData(brand, connection, filters);
      results.push(...volatileData);
    }
    
    return results;
  }

  async fetchVolatileData(brand, connection, filters) {
    
    const query = this.buildVolatileQuery(brand, filters);
    const results = await connection.execute(query);
    
    return results.map(result => ({
      id: result.id,
      brand,
      size: result.size || result.product_size || result.item_size,
      stock: result.stock || result.product_stock || result.item_instock
    }));
  }

  mergeResults(materializedData, virtualData) {
    return materializedData.map(item => {
      const volatileInfo = virtualData.find(v => 
        v.brand === item.brand && v.id === item.id
      );
      
      return {
        ...item,
        ...(volatileInfo || {})
      };
    });
  }

  buildVolatileQuery(brand, filters) {
    
    const fieldMappings = {
      vanHeusen: {
        size: 'product_size',
        stock: 'product_stock'
      },
      levis: {
        size: 'item_size',
        stock: 'item_instock'
      },
      peterEngland: {
        size: 'size',
        stock: 'stock'
      }
    };

    const mapping = fieldMappings[brand];
    return `SELECT id, ${mapping.size}, ${mapping.stock} FROM products WHERE ${this.buildWhereClause(filters, brand)}`;
  }

  async refreshMaterializedView() {
    console.log('Refreshing materialized view...');
    const newData = await this.fetchAllProductData();
    this.materializedData = this.createMaterializedView(newData);
    this.eventEmitter.emit('viewRefreshed');
  }
}

module.exports = DataIntegrationService;