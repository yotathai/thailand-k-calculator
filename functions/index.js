const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");

exports.tpsoapi = onRequest({ cors: true }, async (req, res) => {
  try {
    const targetUrl = "https://index-api.tpso.go.th" + req.url;
    
    // Forward the GET request to TPSO API
    const response = await axios.get(targetUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Yotathai-K-App/1.0"
      }
    });
    
    // Set caching to reduce hits to TPSO
    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    
    // Return data
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error proxying to TPSO:", error.message);
    const status = error.response ? error.response.status : 500;
    const data = error.response ? error.response.data : { error: "Failed to fetch from TPSO API" };
    res.status(status).json(data);
  }
});
