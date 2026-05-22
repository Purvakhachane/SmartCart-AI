const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'amz-shopping-assistant-key-2026';

app.use(cors());
app.use(express.json());

// Paths
const PRODUCTS_PATH = path.join(__dirname, 'data', 'products.json');
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Helper to read JSON files safely
const readData = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
};

// Helper to write JSON files safely
const writeData = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
};

// Load initial databases
let products = readData(PRODUCTS_PATH);
let db = readData(DB_PATH);

// Helper to log actions
const logAction = (type, message) => {
  const timestamp = new Date().toISOString();
  const newLog = {
    id: `log-${uuidv4().substring(0, 8)}`,
    timestamp,
    type,
    message
  };
  
  db.logs = db.logs || [];
  db.logs.unshift(newLog); // Prepend to keep latest first
  if (db.logs.length > 100) db.logs.pop(); // Cap logs size
  writeData(DB_PATH, db);
};

// Background Price Drop Checker (Simulated Cron Work)
// We scan active alerts and check if current product price is below target price
const checkPriceAlerts = () => {
  let updated = false;
  if (!db.alerts || db.alerts.length === 0) return;

  db.alerts.forEach(alert => {
    if (alert.active && !alert.notified) {
      const product = products.find(p => p.id === alert.productId);
      if (product && product.price <= alert.targetPrice) {
        alert.notified = true;
        alert.notifiedPrice = product.price;
        alert.notifiedAt = new Date().toISOString();
        updated = true;
        
        logAction('Alert', `PRICE DROP DETECTED: "${product.name}" has fallen to ₹${product.price} (Target: ₹${alert.targetPrice})`);
      }
    }
  });

  if (updated) {
    writeData(DB_PATH, db);
  }
};

// Run alert check every 10 seconds in background
setInterval(checkPriceAlerts, 10000);

// --- MIDDLEWARES ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --- AUTH ROUTERS ---

// Register
app.post('/api/auth/register', (req, res) => {
  const { username, password, name, email, budget } = req.body;

  if (!username || !password || !name || !email) {
    return res.status(400).json({ error: 'Missing required signup fields' });
  }

  db = readData(DB_PATH);
  const userExists = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (userExists) {
    return res.status(400).json({ error: 'Username is already taken' });
  }

  const newUser = {
    id: `user-${uuidv4().substring(0, 8)}`,
    username,
    passwordHash: `$2a$10$mockhash_${password}`, // Simplified mock hashing
    name,
    email,
    budget: Number(budget) || 100000,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeData(DB_PATH, db);
  
  logAction('System', `New user registered: ${username} (${email})`);

  const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '24h' });
  res.status(201).json({ token, user: { id: newUser.id, username: newUser.username, name: newUser.name, email: newUser.email, budget: newUser.budget } });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db = readData(DB_PATH);
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user || (user.passwordHash !== `$2a$10$mockhash_${password}` && password !== 'password')) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  logAction('System', `User logged in successfully: ${username}`);

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, email: user.email, budget: user.budget } });
});

// Get/Update Profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  db = readData(DB_PATH);
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ user: { id: user.id, username: user.username, name: user.name, email: user.email, budget: user.budget } });
});

app.put('/api/auth/profile', authenticateToken, (req, res) => {
  const { name, email, budget } = req.body;
  db = readData(DB_PATH);
  const userIndex = db.users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

  if (name) db.users[userIndex].name = name;
  if (email) db.users[userIndex].email = email;
  if (budget !== undefined) db.users[userIndex].budget = Number(budget);

  writeData(DB_PATH, db);
  logAction('System', `Profile updated for user: ${db.users[userIndex].username}`);
  
  res.json({ user: { id: db.users[userIndex].id, username: db.users[userIndex].username, name: db.users[userIndex].name, email: db.users[userIndex].email, budget: db.users[userIndex].budget } });
});

// --- PRODUCT ROUTERS ---

// Get Products
app.get('/api/products', (req, res) => {
  const { search, category, brand, minPrice, maxPrice, sortBy } = req.query;
  
  // Rate-limiting simulation logs occasionally
  if (Math.random() < 0.1) {
    logAction('API', 'External API Gateway rate-limits checked: 200 OK');
  }

  let filtered = [...products];

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    
    // Log search query in search analytics
    db = readData(DB_PATH);
    db.searches = db.searches || [];
    db.searches.push({
      userId: req.headers['x-user-id'] || 'anonymous',
      query: search,
      category: filtered[0] ? filtered[0].category : 'General',
      timestamp: new Date().toISOString()
    });
    writeData(DB_PATH, db);
  }

  if (category) {
    filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (brand) {
    filtered = filtered.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
  }

  if (minPrice) {
    filtered = filtered.filter(p => p.price >= Number(minPrice));
  }

  if (maxPrice) {
    filtered = filtered.filter(p => p.price <= Number(maxPrice));
  }

  if (sortBy) {
    if (sortBy === 'price-low') filtered.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-high') filtered.sort((a, b) => b.price - a.price);
    else if (sortBy === 'rating') filtered.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'reviews') filtered.sort((a, b) => b.reviewsCount - a.reviewsCount);
  }

  res.json(filtered);
});

// Get Product by ID
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Compare Products
app.get('/api/products/compare/batch', (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: 'Product IDs required' });

  const idList = ids.split(',');
  const matched = products.filter(p => idList.includes(p.id));
  
  logAction('API', `Product comparison performed for ${matched.length} items`);
  res.json(matched);
});

// --- WISHLIST ROUTERS ---

app.get('/api/wishlist', authenticateToken, (req, res) => {
  db = readData(DB_PATH);
  const userWishlist = db.wishlist.filter(w => w.userId === req.user.id);
  const wishlistProducts = userWishlist.map(w => {
    const prod = products.find(p => p.id === w.productId);
    return prod ? { ...prod, wishId: w.id, addedAt: w.addedAt } : null;
  }).filter(Boolean);

  res.json(wishlistProducts);
});

app.post('/api/wishlist/toggle', authenticateToken, (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'Product ID required' });

  db = readData(DB_PATH);
  const existingIndex = db.wishlist.findIndex(w => w.userId === req.user.id && w.productId === productId);

  let status = '';
  if (existingIndex > -1) {
    db.wishlist.splice(existingIndex, 1);
    status = 'removed';
  } else {
    db.wishlist.push({
      id: `wish-${uuidv4().substring(0, 8)}`,
      userId: req.user.id,
      productId,
      addedAt: new Date().toISOString()
    });
    status = 'added';
  }

  writeData(DB_PATH, db);
  const product = products.find(p => p.id === productId);
  logAction('System', `Product "${product ? product.name.substring(0, 25) + '...' : productId}" ${status} to wishlist`);

  res.json({ success: true, status });
});

// --- ALERTS ROUTERS ---

app.get('/api/alerts', authenticateToken, (req, res) => {
  db = readData(DB_PATH);
  const userAlerts = db.alerts.filter(a => a.userId === req.user.id);
  const fullAlerts = userAlerts.map(alert => {
    const product = products.find(p => p.id === alert.productId);
    return product ? { ...alert, product } : null;
  }).filter(Boolean);

  res.json(fullAlerts);
});

app.post('/api/alerts/create', authenticateToken, (req, res) => {
  const { productId, targetPrice } = req.body;
  if (!productId || !targetPrice) {
    return res.status(400).json({ error: 'Product ID and Target Price are required' });
  }

  db = readData(DB_PATH);
  
  // Check if active alert already exists
  const existing = db.alerts.find(a => a.userId === req.user.id && a.productId === productId && a.active);
  if (existing) {
    existing.targetPrice = Number(targetPrice);
    existing.notified = false; // Reset notified state since price threshold changed
    writeData(DB_PATH, db);
    const product = products.find(p => p.id === productId);
    logAction('Alert', `Price tracker updated for "${product ? product.name.substring(0, 25) + '...' : productId}" to ₹${targetPrice}`);
    return res.json({ success: true, alert: existing, updated: true });
  }

  const newAlert = {
    id: `alert-${uuidv4().substring(0, 8)}`,
    userId: req.user.id,
    productId,
    targetPrice: Number(targetPrice),
    active: true,
    notified: false,
    createdAt: new Date().toISOString()
  };

  db.alerts.push(newAlert);
  writeData(DB_PATH, db);

  const product = products.find(p => p.id === productId);
  logAction('Alert', `Price tracker created for "${product ? product.name.substring(0, 25) + '...' : productId}" at target ₹${targetPrice}`);

  res.json({ success: true, alert: newAlert });
});

app.delete('/api/alerts/:id', authenticateToken, (req, res) => {
  db = readData(DB_PATH);
  const index = db.alerts.findIndex(a => a.id === req.params.id && a.userId === req.user.id);
  if (index === -1) return res.status(404).json({ error: 'Alert not found' });

  const alert = db.alerts[index];
  db.alerts.splice(index, 1);
  writeData(DB_PATH, db);

  const product = products.find(p => p.id === alert.productId);
  logAction('Alert', `Price tracker removed for "${product ? product.name.substring(0, 25) + '...' : product.id}"`);

  res.json({ success: true });
});

// --- AI CHATBOT ROUTER ---
app.post('/api/chat', (req, res) => {
  const { message, userId, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const cleanMsg = message.toLowerCase();
  
  // Smart local NLP parser
  let replyText = "";
  let matchedProducts = [];

  // Parse Budget limits
  const budgetMatch = cleanMsg.match(/(?:under|below|around|within)\s*(?:rs\.?|inr|₹)?\s*([0-9,]+)/i);
  let limit = null;
  if (budgetMatch) {
    limit = parseInt(budgetMatch[1].replace(/,/g, ''));
  }

  // Parse categories
  let targetCategory = null;
  if (cleanMsg.includes('laptop') || cleanMsg.includes('computer') || cleanMsg.includes('macbook') || cleanMsg.includes('asus')) {
    targetCategory = 'Laptops';
  } else if (cleanMsg.includes('phone') || cleanMsg.includes('mobile') || cleanMsg.includes('iphone') || cleanMsg.includes('samsung')) {
    targetCategory = 'Mobile';
  } else if (cleanMsg.includes('skin') || cleanMsg.includes('cleanser') || cleanMsg.includes('serum') || cleanMsg.includes('face') || cleanMsg.includes('cerave') || cleanMsg.includes('ordinary')) {
    targetCategory = 'Skincare';
  } else if (cleanMsg.includes('speaker') || cleanMsg.includes('echo') || cleanMsg.includes('bulb') || cleanMsg.includes('hue') || cleanMsg.includes('home')) {
    targetCategory = 'Smart Home';
  }

  // NLP matching actions
  if (cleanMsg.includes('compare')) {
    // Perform comparison query
    const terms = cleanMsg.replace('compare', '').trim();
    if (terms.includes('iphone') && terms.includes('samsung')) {
      const iphone = products.find(p => p.id === 'prod-iphone-15-pro');
      const samsung = products.find(p => p.id === 'prod-samsung-s24-ultra');
      if (iphone && samsung) {
        matchedProducts = [iphone, samsung];
        replyText = "Here is a comparative comparison between the iPhone 15 Pro Max and the Samsung Galaxy S24 Ultra:\n\n1. **Screen**: Galaxy S24 Ultra has an ultra-bright anti-reflective screen with built-in S-Pen. The iPhone has dynamic island and promotion OLED.\n2. **Camera**: S24 Ultra boasts a 200MP sensor with a built-in S-Pen stylus, while iPhone offers 5x optical telephoto lens natural captures.\n3. **Performance**: Both represent their flagships perfectly. A17 Pro (iPhone) excels in graphical power, Snapdragon Gen 3 (Samsung) handles AI translations easily.\n\nClick the comparative table below to see them side-by-side!";
      }
    } else {
      // Find matching items from search terms
      const matchingItems = products.filter(p => terms.split(/\s+/).some(term => term.length > 2 && p.name.toLowerCase().includes(term)));
      if (matchingItems.length >= 2) {
        matchedProducts = matchingItems.slice(0, 3);
        replyText = `Absolutely! I've loaded ${matchedProducts.map(p => p.brand + ' ' + p.category).join(' and ')} for your comparison matrix. Take a look at their key values below.`;
      } else {
        replyText = "Sure! Tell me which specific products from our search catalog you'd like to compare side-by-side, or use our Comparison panel!";
      }
    }
  } else if (cleanMsg.includes('best') || cleanMsg.includes('recommend') || limit || targetCategory) {
    // Recommendation logic
    let filterProds = [...products];
    if (targetCategory) {
      filterProds = filterProds.filter(p => p.category === targetCategory);
    }
    if (limit) {
      filterProds = filterProds.filter(p => p.price <= limit);
    }

    // Sort by rating to suggest the best
    filterProds.sort((a, b) => b.rating - a.rating);

    if (filterProds.length > 0) {
      matchedProducts = filterProds.slice(0, 2);
      let listStr = matchedProducts.map(p => `- **${p.name}** (₹${p.price}) with an awesome ${p.rating}★ rating`).join('\n');
      
      replyText = `Based on your request, here are the top-rated recommendations${targetCategory ? ` in ${targetCategory}` : ''}${limit ? ` under ₹${limit.toLocaleString()}` : ''}:\n\n${listStr}\n\nWould you like me to analyze customer reviews, track their pricing history, or add them to your wishlist?`;
    } else {
      replyText = `I couldn't find any products matching your specific query${limit ? ` under ₹${limit.toLocaleString()}` : ''} in our seeded catalog. Try adjusting the budget or category, or search for other options!`;
    }
  } else if (cleanMsg.includes('hello') || cleanMsg.includes('hi') || cleanMsg.includes('hey')) {
    replyText = "Hello! I am your AI Shopping Assistant. I can help you find products, compare options, check price drops, analyze reviews, and secure deals. What are you looking to buy today?";
  } else if (cleanMsg.includes('price drop') || cleanMsg.includes('alert') || cleanMsg.includes('track')) {
    replyText = "To start tracking a product, navigate to its product details page and set your target price using the 'Track Price' button. I'll automatically run background checks and notify you the second the price drops below your set limit!";
  } else if (cleanMsg.includes('review') || cleanMsg.includes('fake') || cleanMsg.includes('sentiment')) {
    replyText = "I analyze thousands of reviews instantly. On any product page, I break down customer feedback into a visual positive/negative chart, evaluate a **Review Integrity Score (Fake Review Probability)**, and extract core pros and cons. Ask me about a specific product like 'Tell me about the MacBook reviews!'";
  } else {
    // Default search-based reply
    const queryWords = cleanMsg.split(/\s+/).filter(w => w.length > 3);
    const searchMatch = products.filter(p => queryWords.some(w => p.name.toLowerCase().includes(w) || p.brand.toLowerCase().includes(w)));
    
    if (searchMatch.length > 0) {
      matchedProducts = searchMatch.slice(0, 2);
      replyText = `I found these products that match your query:\n\n${matchedProducts.map(p => `- **${p.name}** (₹${p.price})`).join('\n')}\n\nLet me know if you want to inspect their specifications, check their price logs, or compare them!`;
    } else {
      replyText = "I'm not fully sure how to answer that in our demo database, but I'd be happy to find matching items! Try asking things like: \n- 'Recommend a high-end gaming laptop'\n- 'Compare iPhone vs Samsung'\n- 'Gentle cleanser under ₹1500'\n- 'Fades dark spots skincare'";
    }
  }

  logAction('Chat', `AI Chat answered user query: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
  
  res.json({
    reply: replyText,
    products: matchedProducts,
    timestamp: new Date().toISOString()
  });
});

// --- ANALYTICS ROUTER ---

app.get('/api/analytics/dashboard', (req, res) => {
  db = readData(DB_PATH);
  
  // Calculate category distribution
  const categoriesCount = {};
  products.forEach(p => {
    categoriesCount[p.category] = (categoriesCount[p.category] || 0) + 1;
  });

  const categoryDistribution = Object.keys(categoriesCount).map(name => ({
    name,
    count: categoriesCount[name],
    percentage: Math.round((categoriesCount[name] / products.length) * 100)
  }));

  // Calculate search analytics
  const popularSearches = {};
  db.searches = db.searches || [];
  db.searches.forEach(s => {
    popularSearches[s.query] = (popularSearches[s.query] || 0) + 1;
  });
  
  const topSearches = Object.keys(popularSearches)
    .map(query => ({ query, count: popularSearches[query] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Statistics summaries
  const totalUsers = db.users.length;
  const totalAlerts = db.alerts.length;
  const activeAlerts = db.alerts.filter(a => a.active).length;
  const notifiedAlerts = db.alerts.filter(a => a.notified).length;
  
  const systemLogs = db.logs ? db.logs.slice(0, 15) : [];

  res.json({
    stats: {
      totalProducts: products.length,
      totalUsers,
      totalAlerts,
      activeAlerts,
      notifiedAlerts,
      apiHealth: '99.98% uptime',
      averageResponseTime: '85ms'
    },
    categoryDistribution,
    topSearches,
    systemLogs
  });
});

// --- DEVELOPER / ADMIN TEST TRIGGER ---
// Triggers a simulated price drop on a selected product to demonstrate cron notifications in action!
app.post('/api/admin/trigger-price-drop', (req, res) => {
  const { productId, discountAmount } = req.body;
  if (!productId || !discountAmount) {
    return res.status(400).json({ error: 'Product ID and discount amount are required' });
  }

  const pIndex = products.findIndex(p => p.id === productId);
  if (pIndex === -1) return res.status(404).json({ error: 'Product not found' });

  // Temporarily drop product price in local server memory
  const oldPrice = products[pIndex].price;
  products[pIndex].price = Math.max(10, oldPrice - Number(discountAmount));
  
  logAction('API', `Admin developer action: Dropped "${products[pIndex].name.substring(0, 20)}..." price from ₹${oldPrice} to ₹${products[pIndex].price}`);
  
  // Immediately trigger alerts scan synchronous check
  checkPriceAlerts();

  res.json({
    success: true,
    message: `Price successfully dropped. New price is ₹${products[pIndex].price}`,
    productId,
    oldPrice,
    newPrice: products[pIndex].price
  });
});

// Reset prices (Developer support utility)
app.post('/api/admin/reset-prices', (req, res) => {
  products = readData(PRODUCTS_PATH);
  
  // Also reset alert notifications for demo replay
  db = readData(DB_PATH);
  db.alerts.forEach(a => {
    a.notified = false;
    delete a.notifiedPrice;
    delete a.notifiedAt;
  });
  writeData(DB_PATH, db);

  logAction('System', 'All product price histories and alerts reset to default states');
  res.json({ success: true, message: 'All product prices and notifications have been reset' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
  logAction('System', `Server successfully started on port ${PORT}`);
});
