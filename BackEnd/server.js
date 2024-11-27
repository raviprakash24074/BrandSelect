// backend/server.js
const express = require('express');
const cors = require('cors');
const queryHandler = require('./services/queryHandler');
const dbConnections = require('./config/db.connections');
const QueryFederation = require('./services/queryFederation');
const QueryAnalyzer = require('./services/queryAnalyzer');
const QueryDecomposer = require('./services/queryDecomposer');
const SchemaMapper = require('./services/schemaMapper');
const ResultAggregator = require('./services/resultAggregator');
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
    
    if (typeof rawResponse !== "string")
    {
      console.error("rawResponse is not a string:", rawResponse);
      return { error: "Invalid response format from LLM" };
    }
    const jsonMatch = rawResponse.match(/{.*}/s); 
    if (jsonMatch)
    {
      try
      {
        return JSON.parse(jsonMatch[0]);
      } catch (e)
      {
        console.error("Failed to parse JSON:", e);
        return { error: "Invalid JSON format" };
      }
    }
    return { error: "No JSON object found in response" };
  }



  app.post('/query', async (req, res) => {
    try {
      // Extract the queries and filters from the request body
      const { queries: userQueries, filters } = req.body;

     
      
      // Map each query with its corresponding filter
      const queryPayload = userQueries.map((query, index) => ({
        query,
        filters: filters[index],
      }));
  
      console.log('Mapped Query Payload:', JSON.stringify(queryPayload, null, 2));
      const results = await federationService.executeQuery(queryPayload);
      res.json({ results });
    } catch (error) {
      console.error('Error processing queries:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

  


  app.post('/text-query', async (req, res) => {
    try
    {
      const userQuery = req.body.query;
      if (!userQuery)
      {
        return res.status(400).json({ error: 'Query is required' });
      }

      console.log(`User Query: ${userQuery}`);

      const prompt = `
      Parse the following user query: "${userQuery}".
      Generate mySQL(like) and mongodb(use regex) queries:
      - SQL for MySQL database (e.g., Van Heusen(tableName- Products))
      - NoSQL for MongoDB (e.g., Peter England)
      - Not use Brand filter
      - Response must follow output format(strictly follow).
      Output format:
      {
        "mysql": "<SQL query>",
        "mongodb": "<NoSQL query>"
      }
      example:
      "query input": "Give white shirts from Peter England"
      "output format":
      {
          "mysql": null,
          "mongodb": {"category": {"$regex": "^shirts$","$options": "i"},"color": {"$regex": "^white$","$options": "i"}},
      },
      "query input": "Find jackets in size L from Van Heusen"
       "output format":
      {
          "mysql": "SELECT * FROM products WHERE category='jackets' AND size='L';",
          "mongodb": null
      },
      "query input": "Find Jackets in size L."
      "output format": 
      {
          "mysql": "SELECT * FROM products WHERE category='shoes' AND size='10';",
          "mongodb": {"category": {"$regex": "^shoes$","$options": "i"}, "size": {"$regex": "^10$","$options": "i"}}
      }
      Ensure the output ends with the closing JSON brace or Stop after providing the output in this format.
      `;


      const result = await model.generateContent(prompt);
      const parsedResponse = extractJSON(result.response.text());
      const sqlquery = parsedResponse.mysql;
      const mongodb = parsedResponse.mongodb;

     
      const dbResults = await queryHandler.fetchDataFromGeneratedQueries({ sqlquery, mongodb });

     
      const combinedResults = [...(dbResults.mysql || []), ...(dbResults.mongodb || []), ];

      this.resultAggregator = new ResultAggregator();
      const LLMresults = this.resultAggregator.aggregateResults(combinedResults);


      
      const geminiRecommendationsPrompt = `Given the query: ${userQuery}
      - Recommend complementary products based on the category (e.g., jeans for shirts, shirts for jeans).
      - If a brand is specified, provide a short review (fabric quality, style, dummy data).
      - If a size is mentioned, suggest Indian sizing insights.
      - not copy give example but take idea how look like text
      example:
      {
        "Pair these white shirts with navy blue jeans or khaki chinos for a smart look. For general sizing, M corresponds to a 40-42 inch chest size in India."
        "Style these black jeans with light-colored shirts like sky blue or pastel shades. Van Heusen is known for its premium quality and tailored fits."
        "Match these red hoodies with dark blue jeans or black joggers for a sporty look. Peter England hoodies offer durable fabrics and comfortable fits."
      }
      Limit the response to 3 sentences.
      `;

      const recommendationResult = await model.generateContent(geminiRecommendationsPrompt, { max_length: 10 });
      console.log(recommendationResult.response.text());
     
      res.json({
        results: LLMresults,
        llmtext: recommendationResult.response.text(),
      });
    } catch (error)
    {
      console.error('Error processing text query:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

initialize().catch(err => {
  console.error('Failed to initialize the server:', err);
});