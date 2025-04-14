// server.js - URL Shortener Microservice
// Where your node app starts

// Required dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dns = require('dns');
const app = express();
const mongoose = require('mongoose');

// Basic Configuration
const port = process.env.PORT || 3000;

// Connect to MongoDB database
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/shorturl', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Create URL schema and model
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true }
});

const URL = mongoose.model('URL', urlSchema);

// Use body-parser middleware to handle POST requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Enable CORS for all requests
app.use(cors());

// Serve static files from the public directory
app.use('/public', express.static(`${process.cwd()}/public`));

// Route for the home page
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Helper function to validate URLs
function isValidUrl(url) {
  try {
    const newUrl = new URL(url);
    return newUrl.protocol === 'http:' || newUrl.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

// POST endpoint to create short URLs
app.post('/api/shorturl', function(req, res) {
  const originalUrl = req.body.url;
  
  // Validate URL format
  if (!isValidUrl(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }
  
  // Extract hostname for DNS lookup
  const urlObject = new URL(originalUrl);
  const hostname = urlObject.hostname;
  
  // Verify that the URL exists using DNS lookup
  dns.lookup(hostname, (err) => {
    if (err) {
      return res.json({ error: 'invalid url' });
    }
    
    // Check if URL already exists in database
    URL.findOne({ original_url: originalUrl }, (err, data) => {
      if (err) return console.error(err);
      
      if (data) {
        // URL already exists, return existing data
        return res.json({
          original_url: data.original_url,
          short_url: data.short_url
        });
      } else {
        // Count documents to determine the next short URL number
        URL.countDocuments({}, (err, count) => {
          if (err) return console.error(err);
          
          // Create new short URL entry
          const newUrl = new URL({
            original_url: originalUrl,
            short_url: count + 1
          });
          
          // Save to database
          newUrl.save((err, data) => {
            if (err) return console.error(err);
            res.json({
              original_url: data.original_url,
              short_url: data.short_url
            });
          });
        });
      }
    });
  });
});

// GET endpoint to redirect short URLs
app.get('/api/shorturl/:short_url', function(req, res) {
  const shortUrl = parseInt(req.params.short_url);
  
  // Find the original URL in the database
  URL.findOne({ short_url: shortUrl }, (err, data) => {
    if (err || !data) {
      return res.json({ error: 'No short URL found for the given input' });
    }
    
    // Redirect to the original URL
    res.redirect(data.original_url);
  });
});

// 404 handler for unknown routes
app.use(function(req, res) {
  res.status(404).type('text').send('Not Found');
});

// Start the server
app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});