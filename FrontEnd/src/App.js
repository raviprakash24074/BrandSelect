






import React, { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [queries, setQueries] = useState([]);
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [filters, setFilters] = useState({
    size: "",
    color: "",
    price: { min: "", max: "" },
  });
  const [responseData, setResponseData] = useState([]);
  const [llmResponse, setLLMResponse] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const handleBuyNow = async (Id, brand) => {
    try {
      const response = await axios.post("http://localhost:5000/buy", {
        Id,
        brand,
      });

      // Update UI based on stock
      if (response.data.stock === 0) {
        setResponseData(responseData.filter((item) => item.id !== Id));
      } else {
        setResponseData(
          responseData.map((item) =>
            item.id === Id
              ? { ...item, stock: response.data.stock }
              : item
          )
        );
      }

      // Display popup message
      alert("Thank you! Your order will be delivered in two days.");
    } catch (error) {
      if (error.response?.data?.error === "Out of stock") {
        alert("This item is out of stock.");
      } else {
        console.error("Error processing order:", error);
        alert("Failed to process the order.");
      }
    }
  };

  const handleAddQuery = () => {
    // if (brand &category) {
    setQueries([...queries, { brand, category, filters }]);
    setBrand("");
    setCategory("");
    setFilters({ size: "", color: "", price: { min: "", max: "" } });
    // } else {
    //   alert("Please select category and brand.");
    // }
  };

  const handleDeleteQuery = (index) => {
    const updatedQueries = queries.filter((_, i) => i !== index);
    setQueries(updatedQueries);
  };
  const handleSendQueries = async () => {
    try {
      const combinedQueries = queries.map(({ category, brand, filters }) => ({
        query: `${category} from ${brand}`,
        filters,
      }));

      console.log("Payload to send:", combinedQueries);

      const response = await axios.post("http://localhost:5000/query", {
        queries: combinedQueries.map((q) => q.query),
        filters: combinedQueries.map((q) => q.filters),
      });

      // Process the response data
      setResponseData(response.data.results);
      console.log('UI',response.data.results);
    } catch (error) {
      console.error("Error sending queries:", error);
      alert("Failed to send queries.");
    }
  };

  const handleTextQuery = async () => {
    if (!textQuery.trim()) {
      alert("Please enter a query.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/text-query", {
        query: textQuery,
      });

      setResponseData(response.data.results || []);
      setLLMResponse(response.data.recommendations || "");
    } catch (error) {
      console.error("Error processing text query:", error);
      alert("Failed to process the text query.");
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div>
          <h1>Brand Select</h1>
          <p className="slogan">All the brands you love, now in one place.</p>
        </div>
        <div className="header-icons">
          <span className="header-icon">🛒</span>
          <span className="header-icon">👤</span>
        </div>
      </header>

      <div className="query-builder">
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="" disabled>
            Select Brand
          </option>
          <option value="van_heusen">Van Heusen</option>
          <option value="Peter_England">Peter England</option>
          <option value="">None</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="" disabled>
            Select Category
          </option>
          <option value="jeans">Jeans</option>
          <option value="shirts">Shirts</option>
          <option value="tshirts">T-Shirts</option>
          <option value="jackets">Jackets</option>
        </select>
        <select
          value={filters.size}
          onChange={(e) => setFilters({ ...filters, size: e.target.value })}
        >
          <option value="" disabled>
            Select Size
          </option>
          <option value="X">X</option>
          <option value="XL">XL</option>
          <option value="L">L</option>
          <option value="M">M</option>
          <option value="32">32</option>
          <option value="30">30</option>
        </select>
        <select
          value={filters.color}
          onChange={(e) => setFilters({ ...filters, color: e.target.value })}
        >
          <option value="" disabled>
            Select Color
          </option>
          <option value="red">Red</option>
          <option value="blue">Blue</option>
          <option value="green">Green</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
        <div className="price-range">
          <input
            type="number"
            placeholder="Min Price"
            value={filters.price.min}
            onChange={(e) =>
              setFilters({
                ...filters,
                price: { ...filters.price, min: e.target.value },
              })
            }
          />
          <input
            type="number"
            placeholder="Max Price"
            value={filters.price.max}
            onChange={(e) =>
              setFilters({
                ...filters,
                price: { ...filters.price, max: e.target.value },
              })
            }
          />
        </div>

        <button className="btn-add" onClick={handleAddQuery}>
          Add Query
        </button>
      </div>

      <div className="queries">
        <h2>Queries</h2>
        <ul>
          {queries.map((q, idx) => (
            <li key={idx} className="query-item">
              <span>
                {q.category} from {q.brand}, Filters:{" "}
                {JSON.stringify(q.filters)}
              </span>
              <button
                className="btn-delete"
                onClick={() => handleDeleteQuery(idx)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button className="btn-send" onClick={handleSendQueries}>
        Send Queries
      </button>

      <div className="text-query">
        <h2>Search Using Natural Language</h2>
        <textarea
          value={textQuery}
          onChange={(e) => setTextQuery(e.target.value)}
          placeholder="Type your query here..."
        />
        <button className="btn-send" onClick={handleTextQuery}>
          Send Text Query
        </button>
      </div>

      <main>
        <h2>Results</h2>
        <div className="results">
          {responseData.map((item, idx) => {
            let link;

            if (item.category === "Shirts" && item.Brand === "Peter England") {
              link =
                "https://peterengland.abfrl.in/shop/men-shirts?source=menu&page=1";
            } else if (
              item.category === "Jeans" &&
              item.Brand === "Peter England"
            ) {
              link = "https://peterengland.abfrl.in/c/jeans";
            } else if (
              item.category === "Shirts" &&
              item.Brand === "Van Heusen"
            ) {
              link = "https://vanheusenindia.abfrl.in/shop/men-shirts";
            } else if (
              item.category === "Jeans" &&
              item.Brand === "Van Heusen"
            ) {
              link = "https://vanheusenindia.abfrl.in/c/men-jeans";
            } else {
              link = "#";
            }

            return (
              <div key={idx} className="result-item">
                <h3>{item.brand}</h3>
                <p>Name: {item.name}</p>
               
                <p>Category: {item.category}</p>
                <p>Price: {item.price}</p>
                <p>Color: {item.color}</p>
                <p>Size: {item.size}</p>
                <p>Stock: {item.stock}</p>
                <p>Brand: {item.Brand}</p>
                <a href={link} target="_blank" rel="noopener noreferrer">
                <button>Buy Now</button>
              </a>
              </div>
            );
          })}
        </div>

        <div className="llm-text">
          <h2>LLM Recommendations</h2>
          <p>{llmResponse}</p>
        </div>
      </main>
    </div>
  );
}

export default App;

