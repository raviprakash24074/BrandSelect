// backend/server.js
const express = require("express");
const cors = require("cors");
const queryHandler = require("./services/queryHandler");
const dbConnections = require("./config/db.connections");
const QueryFederation = require("./services/queryFederation");
const QueryAnalyzer = require("./services/queryAnalyzer");
const QueryDecomposer = require("./services/queryDecomposer");
const SchemaMapper = require("./services/schemaMapper");
const ResultAggregator = require("./services/resultAggregator");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI("AIzaSyDr0Xv7oaDCU9JyVbG5cZEonPto7ZJ13rU");

// Use the Gemini model
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
async function initialize() {
  await dbConnections.initialize();
  const queryAnalyzer = new QueryAnalyzer();
  const queryDecomposer = new QueryDecomposer(new SchemaMapper());
  const federationService = new QueryFederation(
    dbConnections,
    queryAnalyzer,
    queryDecomposer
  );

  function extractJSON(rawResponse) {
    if (typeof rawResponse !== "string") {
      console.error("rawResponse is not a string:", rawResponse);
      return { error: "Invalid response format from LLM" };
    }
    const jsonMatch = rawResponse.match(/{.*}/s);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Failed to parse JSON:", e);
        return { error: "Invalid JSON format" };
      }
    }
    return { error: "No JSON object found in response" };
  }

  //   app.post('/query', async (req, res) => {
  //   try {
  //     const { queries: userQueries, filters } = req.body;
  //     const queryPayload = userQueries.map((query, index) => ({
  //       query,
  //       filters: filters[index],
  //     }));

  //     console.log('Mapped Query Payload:', JSON.stringify(queryPayload, null, 2));
  //     const results = await federationService.executeQuery(queryPayload);
  //     res.json({ results });
  //   } catch (error) {
  //     if (error.message.includes('No results found')) {
  //       res.status(404).json({ error: 'No results found. Check your query or database availability.' });
  //     } else {
  //       res.status(500).json({ error: 'Internal server error' });
  //     }
  //   }
  // });
  app.post("/query", async (req, res) => {
    try {
      const { queries: userQueries, filters } = req.body;
      const queryPayload = userQueries.map((query, index) => ({
        query,
        filters: filters[index],
      }));

      console.log(
        "Mapped Query Payload:",
        JSON.stringify(queryPayload, null, 2)
      );
      const results = await federationService.executeQuery(queryPayload);
      res.json({ results });
    } catch (error) {
      if (error.message.includes("No results found")) {
        res.status(404).json({
          error: "No results found. Check your query or database availability.",
        });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.post("/buy", async (req, res) => {
    const { Id, brand } = req.body;
    console.log("buy:", Id, brand) 
    try {
      console.log('1');
      // Handle Van Heusen (MySQL) products
      if (brand === "Van Heusen") {
        const connection = await dbConnections.getConnection("van_heusen");
        const [product] = await connection.execute(
          `SELECT product_stock FROM products WHERE product_id = ?`,
          [Id]
        );
        console.log('2')
        console.log('prod',product);
        if (!product.length)
          return res.status(404).json({ error: "Product not found" });
        if (product[0].stock === 0)
          return res.status(400).json({ error: "Out of stock" });

        const newStock = product[0].stock - 1;
        if (newStock === 0) {
          await connection.execute(`DELETE FROM products WHERE product_id = ?`, [
            Id,
          ]);
          return res.json({ success: true, stock: 0 });
        } else {
          await connection.execute(
            `UPDATE products SET product_stock = ? WHERE product_id = ?`,
            [newStock, Id]
          );
          return res.json({ success: true, stock: newStock });
        }
      }

      // Handle Peter England (MongoDB) products
      if (brand === "Peter England") {
        const connection = await dbConnections.getConnection("Peter_England");
        const product = await connection.db
          .collection("Items")
          .findOne({ _id: Id });

        if (!product)
          return res.status(404).json({ error: "Product not found" });
        if (product.stock === 0)
          return res.status(400).json({ error: "Out of stock" });

        const newStock = product.stock - 1;
        if (newStock === 0) {
          await connection.db.collection("Items").deleteOne({ _id: Id });
          return res.json({ success: true, stock: 0 });
        } else {
          await connection.db
            .collection("Items")
            .updateOne({ _id: Id }, { $set: { stock: newStock } });
          return res.json({ success: true, stock: newStock });
        }
      }

      return res.status(400).json({ error: "Invalid brand" });
    } catch (error) {
      console.error("Error processing buy request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/text-query", async (req, res) => {
    try {
      const userQuery = req.body.query;
      if (!userQuery) {
        return res.status(400).json({ error: "Query is required" });
      }

      console.log(`User Query: ${userQuery}`);

      // Define recognized brands using regex patterns
      // const recognizedBrands = {
      //   "peter england": /peter\s*england/i,
      //   "van heusen": /van\s*heusen|van/i,
      // };

      // // Detect brand in the query
      // let brand = null;
      // for (const [key, pattern] of Object.entries(recognizedBrands)) {
      //   if (pattern.test(userQuery)) {
      //     brand = key;
      //     break;
      //   }
      // }
      // console.log("brand",brand);
      // // Handle unrecognized brands
      // if (!brand && /brand|company/i.test(userQuery)) {
      //   return res.status(400).json({
      //     error: "No recognized brand found. Supported brands are Peter England and Van Heusen.",
      //   });
      // }
      const adjustedPrompt = `
  Parse the following user query: "${userQuery}".
  - Detect the target brand using regex:
    - "Peter England" -> matches any variation like "Peter england", "peter England", "peterengland","Peter","peter", "peter_engalnd", "peter england".
    - "Van Heusen" -> matches any variation like "Van", "van", "van heusen", "Vanheusen","heusen", "van hausen".
  - Use the detected brand to decide:
    - ***If "Peter England" is detected, generate a MongoDB query for the "Items" collection and set SQL query to null.***
    - ***If "Van Heusen" is detected, generate an SQL query for the "Products" table and set MongoDB query to null.***
    - ***If no brand is detected(like "Peter England" or "Van Heusen"), generate queries for both databases.***
    - ***If an unrecognized brand("killer","levi's","H&M","Zara" etc....) is detected, respond with an error.***
  - Exclude any mention of the brand as a filter in the generated queries.
  - Include filters for:
    - Numeric conditions: "price less than 500", "price > 1000", "price between 500 and 1500".
    - Exact matches: "size L", "color white".
    - Logical combinations: "size L and color white".
  - Respond strictly in JSON format:
  {
    "mysql": "<SQL query or null>",
    "mongodb": "<MongoDB query or null>"
  }

  **Examples**:
  1. **Query**: "Find white shirts size L price <2000 from Peter England"
     **Output**:
     {
       "mysql": null,
       "mongodb": {"category": {"$regex": "^shirts$", "$options": "i"}, "size": {"$regex": "^L$", "$options": "i"}, "color": {"$regex": "^white$", "$options": "i"}, "price": {"$lt": 2000}}
     }

  2. **Query**: "Get jackets size M price >1000 from Van Heusen"
     **Output**:
     {
       "mysql": "SELECT * FROM products WHERE category='jackets' AND size='M' AND price > 1000;",
       "mongodb": null
     }

  3. **Query**: "Show jeans size 32 price 500 to 1500"
     **Output**:
     {
       "mysql": "SELECT * FROM products WHERE category='jeans' AND size='32' AND price >= 500 AND price <= 1500;",
       "mongodb": {"category": {"$regex": "^jeans$", "$options": "i"}, "size": {"$regex": "^32$", "$options": "i"}, "price": {"$gte": 500, "$lte": 1500}}
     }

  Ensure the brand name is not included as a filter in either SQL or MongoDB queries.
  Ensure the response is valid JSON and ends after the closing brace.
`;
      // Dynamically adjust the prompt based on the detected brand
      // const adjustedPrompt = `
      //   Parse the following user query: "${userQuery}".
      //   ${
      //     brand === "peter england"
      //       ? "Generate a MongoDB query for the 'Items' collection. Set SQL query to null."
      //       : brand === "van heusen"
      //       ? "Generate an SQL query for the 'Products' table. Set MongoDB query to null."
      //       : "Generate both SQL and MongoDB queries."
      //   }
      //   - If "Peter England" is mentioned, generate a MongoDB query for the "Items" collection.
      //   - If "Van Heusen" is mentioned, generate a MySQL query for the "Products" table.
      //   - If no brand is mentioned, generate queries for both databases.
      //   - If an unrecognized brand is detected, respond with an error.
      //   - Normalize terms using regex:
      //       - "price under", "lesser than", "below" -> "price <".
      //       - "more than", "greater than", "above" -> "price >".
      //       - Correct common typos: e.g., "ejans" -> "jeans", "shrits" -> "shirts".
      //   - Detect filters using regex:
      //     - Numeric conditions: "price less than 500", "price > 1000", "price between 500 and 1500".
      //     - Exact matches: "size L", "color white".
      //     - Logical combinations: "size L and color white".
      //   - Ensure output is in valid JSON format:
      //   {
      //     "mysql": "<SQL query or null>",
      //     "mongodb": "<MongoDB query or null>"
      //   }

      //   **Examples**:
      //   1. **Query**: "Find white shirts size L price <2000 from Peter England"
      //      **Output**:
      //      {
      //        "mysql": null,
      //        "mongodb": {"category": {"$regex": "^shirts$", "$options": "i"}, "size": {"$regex": "^L$", "$options": "i"}, "color": {"$regex": "^white$", "$options": "i"}, "price": {"$lt": 2000}}
      //      }

      //   2. **Query**: "Get jackets size M price >1000 from Van Heusen"
      //      **Output**:
      //      {
      //        "mysql": "SELECT * FROM products WHERE category='jackets' AND size='M' AND price > 1000;",
      //        "mongodb": null
      //      }

      //   3. **Query**: "Show jeans size 32 price 500 to 1500"
      //      **Output**:
      //      {
      //        "mysql": "SELECT * FROM products WHERE category='jeans' AND size='32' AND price >= 500 AND price <= 1500;",
      //        "mongodb": {"category": {"$regex": "^jeans$", "$options": "i"}, "size": {"$regex": "^32$", "$options": "i"}, "price": {"$gte": 500, "$lte": 1500}}
      //      }
      // `;

      // Generate SQL and MongoDB Queries using LLM
      const result = await model.generateContent(adjustedPrompt);
      const parsedResponse = extractJSON(result.response.text());
      const sqlquery = parsedResponse.mysql || null;
      const mongodb = parsedResponse.mongodb || null;

      // Fetch data from available databases
      const dbResults = await queryHandler.fetchDataFromGeneratedQueries({
        sqlquery,
        mongodb,
      });

      // Check if no results were retrieved from both databases
      if (!dbResults.mysql && !dbResults.mongodb) {
        console.warn("Both databases are unavailable or returned no data.");
        return res.status(404).json({
          error:
            "No results found. Both databases are unavailable or queries returned no data.",
        });
      }

      // Combine results from both databases (if available)
      const combinedResults = [
        ...(dbResults.mysql || []),
        ...(dbResults.mongodb || []),
      ];

      // Aggregate results
      this.resultAggregator = new ResultAggregator();
      const aggregatedResults =
        this.resultAggregator.aggregateResults(combinedResults);

      // Generate recommendations using LLM
      const recommendationsPrompt = `
        Based on the query: "${userQuery}",
        - Suggest complementary products or insights related to the query.
        - Examples:
          - Suggest matching items (e.g., jeans for shirts, belts for trousers).
          - Provide general sizing advice if size is mentioned.
        - Limit the response to 3 sentences.
      `;

      const recommendationResult = await model.generateContent(
        recommendationsPrompt,
        { max_length: 10 }
      );

      console.log(recommendationResult.response.text());

      // Return results and recommendations
      res.json({
        results: aggregatedResults,
        recommendations: recommendationResult.response.text(),
      });
    } catch (error) {
      console.error("Error processing text query:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

initialize().catch((err) => {
  console.error("Failed to initialize the server:", err);
});

// app.post("/text-query", async (req, res) => {
//   try {
//     const userQuery = req.body.query;
//     if (!userQuery) {
//       return res.status(400).json({ error: "Query is required" });
//     }

//     console.log(`User Query: ${userQuery}`);

//     const prompt = `
//     Parse the following user query: "${userQuery}".
//     Generate mySQL(like) and mongodb(use regex) queries:
//     - SQL for MySQL database (e.g., Van Heusen(tableName- Products))
//     - NoSQL for MongoDB (e.g., Peter England)
//     - Not use Brand filter
//     - Response must follow output format(strictly follow).
//     Output format:
//     {
//       "mysql": "<SQL query>",
//       "mongodb": "<NoSQL query>"
//     }
//     example:
//     "query input": "Give white shirts from Peter England"
//     "output format":
//     {
//         "mysql": null,
//         "mongodb": {"category": {"$regex": "^shirts$","$options": "i"},"color": {"$regex": "^white$","$options": "i"}},
//     },
//     "query input": "Find jackets in size L from Van Heusen"
//      "output format":
//     {
//         "mysql": "SELECT * FROM products WHERE category='jackets' AND size='L';",
//         "mongodb": null
//     },
//     "query input": "Find Jackets in size L."
//     "output format":
//     {
//         "mysql": "SELECT * FROM products WHERE category='shoes' AND size='10';",
//         "mongodb": {"category": {"$regex": "^shoes$","$options": "i"}, "size": {"$regex": "^10$","$options": "i"}}
//     }
//     Ensure the output ends with the closing JSON brace or Stop after providing the output in this format.
//     `;

//     const result = await model.generateContent(prompt);
//     const parsedResponse = extractJSON(result.response.text());
//     const sqlquery = parsedResponse.mysql;
//     const mongodb = parsedResponse.mongodb;

//     const dbResults = await queryHandler.fetchDataFromGeneratedQueries({
//       sqlquery,
//       mongodb,
//     });

//     const combinedResults = [
//       ...(dbResults.mysql || []),
//       ...(dbResults.mongodb || []),
//     ];

//     this.resultAggregator = new ResultAggregator();
//     const LLMresults =
//       this.resultAggregator.aggregateResults(combinedResults);

//     const geminiRecommendationsPrompt = `Given the query: ${userQuery}
//     - Recommend complementary products based on the category (e.g., jeans for shirts, shirts for jeans).
//     - If a brand is specified, provide a short review (fabric quality, style, dummy data).
//     - If a size is mentioned, suggest Indian sizing insights.
//     - not copy give example but take idea how look like text
//     example:
//     {
//       "Pair these white shirts with navy blue jeans or khaki chinos for a smart look. For general sizing, M corresponds to a 40-42 inch chest size in India."
//       "Style these black jeans with light-colored shirts like sky blue or pastel shades. Van Heusen is known for its premium quality and tailored fits."
//       "Match these red hoodies with dark blue jeans or black joggers for a sporty look. Peter England hoodies offer durable fabrics and comfortable fits."
//     }
//     Limit the response to 3 sentences.
//     `;

//     const recommendationResult = await model.generateContent(
//       geminiRecommendationsPrompt,
//       { max_length: 10 }
//     );
//     console.log(recommendationResult.response.text());

//     res.json({
//       results: LLMresults,
//       llmtext: recommendationResult.response.text(),
//     });
//   } catch (error) {
//     console.error("Error processing text query:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

//   app.post("/text-query", async (req, res) => {
//     try
//     {
//       const userQuery = req.body.query;
//       if (!userQuery)
//       {
//         return res.status(400).json({ error: "Query is required" });
//       }

//       console.log(`User Query: ${userQuery}`);
//       const prompt = `
//   Parse the following user query: "${userQuery}".
//   - Detect the target brand using regex:
//     - "Peter England" -> matches any variation like "Peter england", "peter England", "peterengland".
//     - "Van Heusen" -> matches any variation like "Van", "van", "van heusen", "Vanheusen".
//   - If the brand "Peter England" is detected:
//     - Generate a MongoDB query for the "Items" collection.
//     - Set SQL query to null.
//   - If the brand "Van Heusen" is detected:
//     - Generate an SQL query for the "Products" table.
//     - Set MongoDB query to null.
//   - If no brand is mentioned, generate queries for both databases.
//   - Extract relevant filters from the query:
//     - Numeric conditions: e.g., "price less than 500", "price greater than 1000", "price between 500 and 1000".
//     - Exact matches: e.g., "size L", "color white".
//     - Logical combinations: e.g., "size L and color white".
//   - Normalize terms using regex:
//     - "price under", "lesser than", "below" -> "price <".
//     - "more than", "greater than", "above" -> "price >".
//     - Correct common typos: e.g., "ejans" -> "jeans", "shrits" -> "shirts".
//   - Respond strictly in JSON format:
//   {
//     "mysql": "<SQL query or null>",
//     "mongodb": "<MongoDB query or null>"
//   }

//   **Examples**:
//   1. **Query**: "Find white shirts of size L and price less than 2000 from Peter England"
//      **Output**:
//      {
//        "mysql": null,
//        "mongodb": {"category": {"$regex": "^shirts$", "$options": "i"}, "size": {"$regex": "^L$", "$options": "i"}, "color": {"$regex": "^white$", "$options": "i"}, "price": {"$lt": 2000}}
//      }

//   2. **Query**: "Show jackets of size M and price greater than 1000 from Van Heusen"
//      **Output**:
//      {
//        "mysql": "SELECT * FROM products WHERE category='jackets' AND size='M' AND price > 1000;",
//        "mongodb": null
//      }

//   3. **Query**: "Find jeans of size 32 with price between 500 and 1500"
//      **Output**:
//      {
//        "mysql": "SELECT * FROM products WHERE category='jeans' AND size='32' AND price >= 500 AND price <= 1500;",
//        "mongodb": {"category": {"$regex": "^jeans$", "$options": "i"}, "size": {"$regex": "^32$", "$options": "i"}, "price": {"$gte": 500, "$lte": 1500}}
//      }

//   Ensure the response is valid JSON and ends after the closing brace.
// `;
//   const prompt = `
//   Parse the following user query: "${userQuery}".
//   - Correct spelling errors or typos in the query (e.g., "ejans" to "jeans", "SHirts" to "shirts", "Van" to "Van Heusen").
//   - Normalize terms to standard database attributes:
//     - Examples:
//       - "Van", "van", "van Heusen" -> "Van Heusen".
//       - "Peter", "peter england" -> "Peter England".
//       - Variants like "price under", "lesser than", "below" -> "price <".
//       - Variants like "more than", "greater than", "above" -> "price >".
//   - Interpret the intent even with incomplete or unconventional grammar (e.g., "Find 32 size ejans <1000" -> "Find size 32 jeans with price less than 1000").
//   - Extract relevant filters:
//     - Numeric comparisons (e.g., "price less than 500", "price > 1000","price range 500 to 1000").
//     - Exact matches (e.g., "size L", "color white").
//     - Logical combinations (e.g., "size L and color white").
//   - Determine the target brand:
//     - If "Peter England" (or its typo) is mentioned, generate a MongoDB query for its "Items" collection and set SQL query to null.
//     - If "Van Heusen" (or its typo) is mentioned, generate an SQL query for its "Products" table and set MongoDB query to null.
//     - If no brand is mentioned, generate queries for both databases.
//   - Generate:
//     - SQL query for MySQL database.
//     - MongoDB query for MongoDB database.
//   - Respond strictly in JSON format:
//   {
//     "mysql": "<SQL query or null>",
//     "mongodb": "<MongoDB query or null>"
//   }

//   **Examples**:
//   1. **Query**: "Find ejans size 32 price below 1500"
//      **Output**:
//      {
//        "mysql": "SELECT * FROM products WHERE category='jeans' AND size='32' AND price < 1500;",
//        "mongodb": {"category": {"$regex": "^jeans$", "$options": "i"}, "size": {"$regex": "^32$", "$options": "i"}, "price": {"$lt": 1500}}
//      }

//   2. **Query**: "Find white SHirts from van under 2000"
//      **Output**:
//      {
//        "mysql": "SELECT * FROM products WHERE category='shirts' AND color='white' AND price < 2000;",
//        "mongodb": null
//      }

//   3. **Query**: "peter england shrt siz l <1000"
//      **Output**:
//      {
//        "mysql": null,
//        "mongodb": {"category": {"$regex": "^shirt$", "$options": "i"}, "size": {"$regex": "^l$", "$options": "i"}, "price": {"$lt": 1000}}
//      }

//   Ensure the response is valid JSON and ends after the closing brace.
// `;

// LLM Prompt to Generate Queries
// const prompt = `
//   Parse the following user query: "${userQuery}".
//   Generate mySQL(like) and mongodb(use regex) queries:
//   - SQL for MySQL database (e.g., Van Heusen(tableName- Products)).
//   - NoSQL for MongoDB (e.g., Peter England).
//   - Include filters for:
//     - Numeric comparisons (e.g., "price less than 500", "price greater than 100").
//     - Exact matches (e.g., "size L", "color white").
//     - Logical combinations (e.g., "size L and color white").
//   - Do not include brand-specific filters.
//   - If no filters are mentioned, return all results.
//   - Respond strictly in JSON format:
//   {
//     "mysql": "<SQL query>",
//     "mongodb": "<MongoDB query>"
//   }
//   Example:
//   "query input": "Give Red shirts and price should be less than 500"
//   {
//     "mysql": "SELECT * FROM products WHERE category='shirts' AND color='red' AND price < 500;",
//     "mongodb": {"category": {"$regex": "^shirts$", "$options": "i"}, "color": {"$regex": "^red$", "$options": "i"}, "price": {"$lt": 500}}
//   },
//    "query input": "Give 32 size Jeans with price greater than 1000"
//   {
//     "mysql": "SELECT * FROM products WHERE category='Jeans' AND size='32' AND price > 1000;",
//     "mongodb": {"category": {"$regex": "^Jeans$", "$options": "i"}, "size": {"$regex": "^32$", "$options": "i"}, "price": {"$gt": 1000}}
//   },
//    "query input": "Give white shirts of size L  with price range 1000 to 2000"
//   {
//     "mysql": "SELECT * FROM products WHERE category='shirts' AND size='L'  AND color='white' AND price > 1000 AND price < 2000;",
//     "mongodb": {"category": {"$regex": "^shirts$", "$options": "i"}, "size": {"$regex": "^L$", "$options": "i"},"color": {"$regex": "^white$", "$options": "i"}, "price": {"$gt": 2000},"price": {"$lt": 1000}}
//   },
//   "query input": "Give white shirts from Peter England"
//   "output format":
//   {
//     "mysql": null,
//     "mongodb": {"category": {"$regex": "^shirts$","$options": "i"},"color": {"$regex": "^white$","$options": "i"}},
//   },
//   "query input": "Find jackets in size L from Van Heusen"
//   "output format":
//   {
//     "mysql": "SELECT * FROM products WHERE category='jackets' AND size='L';",
//     "mongodb": null
//   },
//   "query input": "Find Jackets in size L."
//   "output format":
//   {
//     "mysql": "SELECT * FROM products WHERE category='shoes' AND size='10';",
//     "mongodb": {"category": {"$regex": "^shoes$","$options": "i"}, "size": {"$regex": "^10$","$options": "i"}}
//   }
//   Ensure the response is valid JSON and ends after the closing brace.
// `;

// Generate SQL and MongoDB Queries
// const result = await model.generateContent(prompt);
// const parsedResponse = extractJSON(result.response.text());
// const sqlquery = parsedResponse.mysql || null;
// const mongodb = parsedResponse.mongodb || null;

// Fetch data from available databases
// const dbResults = await queryHandler.fetchDataFromGeneratedQueries({
//   sqlquery,
//   mongodb,
// });

// Check if no results were retrieved from both databases
// if (!dbResults.mysql && !dbResults.mongodb)
// {
//   console.warn("Both databases are unavailable or returned no data.");
//   return res.status(404).json({
//     error:
//       "No results found. Both databases are unavailable or queries returned no data.",
//   });
// }

// Combine results from both databases (if available)
// const combinedResults = [
//   ...(dbResults.mysql || []),
//   ...(dbResults.mongodb || []),
// ];

// Aggregate results
//     this.resultAggregator = new ResultAggregator();
//     const aggregatedResults =
//       this.resultAggregator.aggregateResults(combinedResults);

//     // Generate recommendations using LLM
//     const recommendationsPrompt = `
//       Based on the query: "${userQuery}",
//       - Suggest complementary products or insights related to the query.
//       - For example, suggest jeans for shirts or general sizing advice if size is mentioned.
//       - Response example:
//       "Pair these white shirts with navy blue jeans for a classic look. For size M, it corresponds to a 40-42 inch chest size in India."
//       Limit the response to 3 sentences.
//     `;

//     const recommendationResult = await model.generateContent(
//       recommendationsPrompt,
//       { max_length: 10 }
//     );

//     console.log(recommendationResult.response.text());

//     // Return results and recommendations
//     res.json({
//       results: aggregatedResults,
//       recommendations: recommendationResult.response.text(),
//     });
//   } catch (error)
//   {
//     console.error("Error processing text query:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
