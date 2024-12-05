const { createMySQLConnection, vanHeusenConfig } = require('../config/mysql.config');
const { createMongoConnection } = require('../config/mongodb.config');
const DatabaseConnections = require("../config/db.connections");

const remapFields = (query, mapping) => {
  const remappedQuery = {};
  for (const [key, value] of Object.entries(query)) {
    const mappedKey = mapping[key] || key;
    remappedQuery[mappedKey] = value;
  }
  return remappedQuery;
};

const fetchDataFromGeneratedQueries = async ({ sqlquery, mongodb }) => {
  const results = {
    mysql: null,
    mongodb: null,
  };

  const dbStatus = DatabaseConnections.getStatus(); // Check DB availability
  const mappings = DatabaseConnections.getunifiedMappings().unifiedMappings;

  // Handle MySQL Query
  if (sqlquery && dbStatus.van_heusen) {
    try {
      const mysqlConnection = await createMySQLConnection(vanHeusenConfig);

      const remappedSqlQuery = sqlquery.replace(
        /\b(category|color|size|price|stock|description|name)\b/g,
        (match) => mappings.van_heusen[match] || match
      );

      console.log('Executing SQL Query:', remappedSqlQuery);
      const [rows] = await mysqlConnection.execute(remappedSqlQuery);
      const Van_Heusen_Response=rows.map((row) => ({ ...row, Brand: "Van Heusen" }));
      results.mysql = Van_Heusen_Response;
      await mysqlConnection.end();
    } catch (error) {
      console.error('Error executing MySQL query:', error);
      results.mysql = null; // Set null if MySQL query fails
    }
  } else if (!dbStatus.van_heusen) {
    console.warn('MySQL database is unavailable.');
  }

  // Handle MongoDB Query
  if (mongodb && dbStatus.Peter_England) {
    try {
      const mongoConnection = await createMongoConnection();

      const remappedMongoQuery = remapFields(mongodb, mappings.Peter_England);

      console.log('Executing MongoDB Query:', remappedMongoQuery);
      const mongoResults = await mongoConnection.db
        .collection('Items')
        .find(remappedMongoQuery)
        .toArray();
      const PaterEnglandreponse=mongoResults.map((item) => ({ ...item, Brand: "Peter England" }));
      results.mongodb = PaterEnglandreponse;
    } catch (error) {
      console.error('Error executing MongoDB query:', error);
      results.mongodb = null; // Set null if MongoDB query fails
    }
  } else if (!dbStatus.Peter_England) {
    console.warn('MongoDB database is unavailable.');
  }

  return results;
};

module.exports = {
  fetchDataFromGeneratedQueries,
};



// const { createMySQLConnection, vanHeusenConfig } = require('../config/mysql.config');
// const { createMongoConnection } = require('../config/mongodb.config');
// const DatabaseConnections = require("../config/db.connections");


// const remapFields = (query, mapping) => {
//   const remappedQuery = {};
//   for (const [key, value] of Object.entries(query)) {
//     const mappedKey = mapping[key] || key; 
//     remappedQuery[mappedKey] = value;
//   }
//   return remappedQuery;
// };


// const fetchDataFromGeneratedQueries = async ({ sqlquery, mongodb }) => {
//   const results = {
//     mysql: null,
//     mongodb: null,
//   };
//   const mappings=DatabaseConnections.getunifiedMappings().unifiedMappings;;
  

//   if (sqlquery) {
//     try {
//       const mysqlConnection = await createMySQLConnection(vanHeusenConfig);

      
//       const remappedSqlQuery = sqlquery.replace(
//         /\b(category|color|size|price|stock|description|name)\b/g,
//         (match) => mappings.van_heusen[match] || match
//       );

//       console.log('Final SQL Query:', remappedSqlQuery);
//       const [rows] = await mysqlConnection.execute(remappedSqlQuery);
//       results.mysql = rows;
//       await mysqlConnection.end();
//     } catch (error) {
//       console.error('Error executing MySQL query:', error);
//       throw new Error('MySQL query execution failed');
//     }
//   }


//   if (mongodb) {
//     try {
//       const mongoConnection = await createMongoConnection();

 
//       const remappedMongoQuery = remapFields(mongodb, mappings.Peter_England);

//       console.log('Final MongoDB Query:', remappedMongoQuery);
//       console.log('Remapped MongoDB Query:', remappedMongoQuery)
//       const mongoResults=await mongoConnection.db.collection('Items').find(remappedMongoQuery).toArray()
//       console.log(mongoResults)
//       results.mongodb = mongoResults;
//     } catch (error) {
//       console.error('Error executing MongoDB query:', error);
//       throw new Error('MongoDB query execution failed');
//     }
//   }
  
//   return results;
// };

// module.exports = {
//   fetchDataFromGeneratedQueries,
// };
