import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, BarChart2, TrendingUp, Heart, Bell, MessageSquare, Shield, 
  Layers, ArrowLeftRight, Check, X, Star, ChevronRight, User, Settings,
  LogOut, Play, RefreshCw, Send, AlertCircle, ShoppingBag, HelpCircle,
  ThumbsUp, Percent, Filter, DollarSign, Activity, FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  // Global States
  const [activePage, setActivePage] = useState('home'); // home, search, detail, compare, chat, dashboard, admin
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState(null); // { token, id, username, name, email, budget }
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  
  // App Products & UI Status States
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [toastQueue, setToastQueue] = useState([]);
  
  // Auth Overlay Form States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // login, register
  const [authForm, setAuthForm] = useState({ username: '', password: '', name: '', email: '', budget: 150000 });
  const [authError, setAuthError] = useState('');

  // Page specific query states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchMinPrice, setSearchMinPrice] = useState('');
  const [searchMaxPrice, setSearchMaxPrice] = useState('');
  const [searchSort, setSearchSort] = useState('rating');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([
    { 
      id: 'welcome', 
      sender: 'bot', 
      text: "Hi! I'm AmzAssistant, your AI Shopping Companion. 🤖🛍️\n\nI can help you search Amazon products, check price drop histories, compare specs side-by-side, analyze reviews, and find outstanding deals!\n\nTry asking me something like:\n• *'Best gaming laptop under ₹70,000'*\n• *'Compare iPhone vs Samsung'*\n• *'Fades dark spots skincare'*",
      timestamp: new Date().toISOString()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatTyping, setChatTyping] = useState(false);

  // Detail Page local states
  const [alertTargetPrice, setAlertTargetPrice] = useState('');

  // Refs
  const chatEndRef = useRef(null);

  // Initialize and Sync Guest Account or token
  useEffect(() => {
    const savedToken = localStorage.getItem('amz_auth_token');
    const savedUser = localStorage.getItem('amz_user_data');
    if (savedToken && savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      // Auto Login as Guest to make demo immediately usable!
      handleGuestLogin();
    }
    fetchProducts();
    
    // Setup background alerts scanner
    const interval = setInterval(() => {
      if (savedToken || localStorage.getItem('amz_auth_token')) {
        fetchAlertsSync();
      }
      fetchAdminStatsSync();
    }, 8000);
    
    return () => clearInterval(interval);
  }, []);

  // Sync scroll on chat addition
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatTyping]);

  // Toast Helper
  const addToast = (title, message, type = 'warning') => {
    const id = `toast-${Date.now()}`;
    setToastQueue(prev => [...prev, { id, title, message, type }]);
    
    // Auto clear toast
    setTimeout(() => {
      setToastQueue(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // API wrappers
  const fetchProducts = async (params = {}) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (params.search) q.append('search', params.search);
      if (params.category) q.append('category', params.category);
      if (params.minPrice) q.append('minPrice', params.minPrice);
      if (params.maxPrice) q.append('maxPrice', params.maxPrice);
      if (params.sortBy) q.append('sortBy', params.sortBy);

      const res = await fetch(`/api/products?${q.toString()}`, {
        headers: { 'x-user-id': user?.id || 'anonymous' }
      });
      const data = await res.json();
      if (res.ok) {
        setProducts(data);
      }
    } catch (e) {
      console.error("Products fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertsSync = async () => {
    const token = localStorage.getItem('amz_auth_token');
    if (!token) return;
    try {
      const res = await fetch('/api/alerts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Look for newly notified alerts to trigger popups!
        data.forEach(newAlert => {
          const oldAlert = alerts.find(a => a.id === newAlert.id);
          if (newAlert.notified && (!oldAlert || !oldAlert.notified)) {
            // Trigger visual fireworks/confetti!
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            addToast(
              "🎯 Price Drop Target Reached!", 
              `"${newAlert.product.name.substring(0, 30)}..." has dropped to ₹${newAlert.notifiedPrice}! (Target: ₹${newAlert.targetPrice})`, 
              'success'
            );
          }
        });
        setAlerts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWishlistSync = async () => {
    const token = localStorage.getItem('amz_auth_token');
    if (!token) return;
    try {
      const res = await fetch('/api/wishlist', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setWishlist(data);
    } catch (e) {}
  };

  const fetchAdminStatsSync = async () => {
    try {
      const res = await fetch('/api/analytics/dashboard');
      const data = await res.json();
      if (res.ok) {
        setLogs(data.systemLogs || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (user) {
      fetchWishlistSync();
      fetchAlertsSync();
    }
  }, [user]);

  // Auth Operations
  const handleGuestLogin = () => {
    const guestUser = { id: 'user-guest', username: 'guest', name: 'Guest User', email: 'guest@shoppingassistant.ai', budget: 150000 };
    setUser(guestUser);
    localStorage.setItem('amz_auth_token', 'mock-guest-jwt-token-2026');
    localStorage.setItem('amz_user_data', JSON.stringify(guestUser));
    logActionOnServer('System', 'Guest User logged in automatically');
  };

  const logActionOnServer = async (type, message) => {
    // Analytics side logs trigger automatically in backend endpoints
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login' 
      ? { username: authForm.username, password: authForm.password }
      : authForm;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
      } else {
        localStorage.setItem('amz_auth_token', data.token);
        localStorage.setItem('amz_user_data', JSON.stringify(data.user));
        setUser(data.user);
        setShowAuthModal(false);
        addToast("Authentication Success", `Welcome back, ${data.user.name}!`, 'success');
        setAuthForm({ username: '', password: '', name: '', email: '', budget: 150000 });
      }
    } catch (err) {
      setAuthError('Server is currently offline. Please run the backend Express server first.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('amz_auth_token');
    localStorage.removeItem('amz_user_data');
    setUser(null);
    setWishlist([]);
    setAlerts([]);
    addToast("Logged Out", "Session ended successfully.", "warning");
    handleGuestLogin(); // Fail-safe fallback to guest mode
  };

  // Wishlist toggle
  const toggleWishlist = async (productId) => {
    const token = localStorage.getItem('amz_auth_token');
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    try {
      const res = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId })
      });
      const data = await res.json();
      if (res.ok) {
        fetchWishlistSync();
        addToast(
          data.status === 'added' ? "Added to Saved List" : "Removed from Saved List", 
          data.status === 'added' ? "Product saved to your wishlist successfully." : "Product removed.",
          data.status === 'added' ? 'success' : 'warning'
        );
      }
    } catch (e) {}
  };

  // Alerts Management
  const createPriceAlert = async (productId, targetPrice) => {
    const token = localStorage.getItem('amz_auth_token');
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (!targetPrice || Number(targetPrice) <= 0) {
      addToast("Invalid Price", "Please input a positive target price drop limit.", "warning");
      return;
    }
    try {
      const res = await fetch('/api/alerts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId, targetPrice })
      });
      const data = await res.json();
      if (res.ok) {
        fetchAlertsSync();
        addToast(
          data.updated ? "Alert Updated" : "Alert Activated", 
          `We will notify you the second the price falls below ₹${Number(targetPrice).toLocaleString()}!`, 
          'success'
        );
        setAlertTargetPrice('');
      }
    } catch (e) {}
  };

  const removePriceAlert = async (alertId) => {
    const token = localStorage.getItem('amz_auth_token');
    if (!token) return;
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAlertsSync();
        addToast("Alert Cancelled", "Price tracking alert disabled for this product.", "warning");
      }
    } catch (e) {}
  };

  // Chat chatbot interaction
  const submitChatMessage = async (msgText = chatInput) => {
    if (!msgText.trim()) return;
    
    const userMsg = { id: `msg-${Date.now()}`, sender: 'user', text: msgText, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgText, userId: user?.id })
      });
      const data = await res.json();
      if (res.ok) {
        // Wait 800ms for natural typing feedback feel
        setTimeout(() => {
          setChatMessages(prev => [...prev, {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: data.reply,
            products: data.products,
            timestamp: data.timestamp
          }]);
          setChatTyping(false);
        }, 800);
      }
    } catch (err) {
      setChatTyping(false);
      setChatMessages(prev => [...prev, {
        id: `bot-err-${Date.now()}`,
        sender: 'bot',
        text: "I'm having trouble connecting to my local NLP brain. Please ensure the backend server is running correctly on port 5000!",
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // Dev actions
  const triggerPriceDropEvent = async (productId, amount) => {
    try {
      const res = await fetch('/api/admin/trigger-price-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, discountAmount: amount })
      });
      const data = await res.json();
      if (res.ok) {
        fetchProducts(); // Refresh list to see price drop!
        fetchAlertsSync(); // Refresh alerts checking
        addToast("Developer: Price Dropped!", data.message, "success");
      }
    } catch (e) {}
  };

  const triggerResetEvent = async () => {
    try {
      const res = await fetch('/api/admin/reset-prices', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        fetchProducts();
        fetchAlertsSync();
        addToast("Developer: System Reset", data.message, "success");
      }
    } catch (e) {}
  };

  // Helper selectors
  const activeProduct = products.find(p => p.id === selectedProductId);

  // Category search utility
  const handleCategoryClick = (category) => {
    setSearchCategory(category);
    setActivePage('search');
    fetchProducts({ category });
  };

  return (
    <div className="app-container" data-theme={theme}>
      {/* Toast Alert Drawer */}
      <div className="toast-container" id="toast-drawer">
        {toastQueue.map(toast => (
          <div 
            key={toast.id} 
            className={`toast-box ${toast.type === 'success' ? 'toast-box-teal' : ''}`}
            id={`toast-item-${toast.id}`}
          >
            <div className="stat-icon-wrapper btn-icon" style={{ fontSize: '1.1rem', background: toast.type === 'success' ? 'rgba(0,242,254,0.1)' : 'rgba(255,153,0,0.1)', color: toast.type === 'success' ? 'var(--color-teal)' : 'var(--color-amazon)' }}>
              {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            </div>
            <div>
              <h4 style={{ fontWeight: '700', fontSize: '0.9rem' }}>{toast.title}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{toast.message}</p>
            </div>
            <button 
              className="toast-close-btn" 
              onClick={() => setToastQueue(prev => prev.filter(t => t.id !== toast.id))}
              id={`close-${toast.id}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Sleek Sidebar Drawer */}
      <aside className="app-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }} id="logo-branding">
          <span style={{ fontSize: '1.75rem', filter: 'drop-shadow(0 0 8px rgba(255,153,0,0.4))' }}>🛍️</span>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', lineHeight: 1 }}>AmzAssistant</h2>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Shopping Brain</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            className={`btn btn-outline ${activePage === 'home' ? 'btn-primary' : ''}`}
            onClick={() => setActivePage('home')}
            style={{ justifyContent: 'flex-start', border: 'none', background: activePage === 'home' ? 'var(--grad-amazon)' : 'transparent' }}
            id="nav-btn-home"
          >
            <TrendingUp size={18} />
            <span>Discover Deals</span>
          </button>

          <button 
            className={`btn btn-outline ${activePage === 'search' ? 'btn-primary' : ''}`}
            onClick={() => { setActivePage('search'); fetchProducts(); }}
            style={{ justifyContent: 'flex-start', border: 'none', background: activePage === 'search' ? 'var(--grad-amazon)' : 'transparent' }}
            id="nav-btn-search"
          >
            <Search size={18} />
            <span>Search Catalog</span>
          </button>

          <button 
            className={`btn btn-outline ${activePage === 'compare' ? 'btn-primary' : ''}`}
            onClick={() => setActivePage('compare')}
            style={{ justifyContent: 'flex-start', border: 'none', background: activePage === 'compare' ? 'var(--grad-amazon)' : 'transparent' }}
            id="nav-btn-compare"
          >
            <ArrowLeftRight size={18} />
            <span>Compare specs</span>
            {compareIds.length > 0 && (
              <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '99px' }}>
                {compareIds.length}
              </span>
            )}
          </button>

          <button 
            className={`btn btn-outline ${activePage === 'chat' ? 'btn-primary' : ''}`}
            onClick={() => setActivePage('chat')}
            style={{ justifyContent: 'flex-start', border: 'none', background: activePage === 'chat' ? 'var(--grad-amazon)' : 'transparent' }}
            id="nav-btn-chat"
          >
            <MessageSquare size={18} />
            <span>AI Chatbot</span>
            <span style={{ marginLeft: 'auto', background: 'var(--grad-teal)', color: '#0b0b0f', fontSize: '0.65rem', padding: '0.1rem 0.4rem', fontWeight: '800', borderRadius: '4px', textTransform: 'uppercase' }}>Live</span>
          </button>

          <button 
            className={`btn btn-outline ${activePage === 'dashboard' ? 'btn-primary' : ''}`}
            onClick={() => setActivePage('dashboard')}
            style={{ justifyContent: 'flex-start', border: 'none', background: activePage === 'dashboard' ? 'var(--grad-amazon)' : 'transparent' }}
            id="nav-btn-dash"
          >
            <Heart size={18} />
            <span>Wishlist & Trackers</span>
          </button>

          <button 
            className={`btn btn-outline ${activePage === 'admin' ? 'btn-primary' : ''}`}
            onClick={() => setActivePage('admin')}
            style={{ justifyContent: 'flex-start', border: 'none', background: activePage === 'admin' ? 'var(--grad-amazon)' : 'transparent' }}
            id="nav-btn-admin"
          >
            <Shield size={18} />
            <span>Telemetry Admin</span>
          </button>
        </nav>

        {/* User Account Widget */}
        <div className="glass-card" style={{ padding: '0.85rem', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} id="user-nav-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="chat-avatar avatar-bg-green" style={{ width: '32px', height: '32px' }}>
              <User size={14} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user ? user.name : 'Guest User'}
              </h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {user ? `@${user.username}` : '@anonymous'}
              </span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.35rem 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Demo Budget:</span>
            <span style={{ fontWeight: '800', color: 'var(--color-teal)' }}>₹{user ? user.budget.toLocaleString() : '0'}</span>
          </div>
          {user && user.username !== 'guest' ? (
            <button className="btn btn-outline" style={{ padding: '0.35rem', fontSize: '0.75rem', width: '100%', gap: '0.35rem' }} onClick={handleLogout} id="logout-btn">
              <LogOut size={12} />
              <span>Log out</span>
            </button>
          ) : (
            <button className="btn btn-primary" style={{ padding: '0.35rem', fontSize: '0.75rem', width: '100%', gap: '0.35rem' }} onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} id="login-trigger-btn">
              <User size={12} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-content">
        
        {/* TOP NAVBAR PANEL */}
        <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '45%' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type="text" 
                placeholder="Search Amazon products dynamically..." 
                className="input-field" 
                style={{ width: '100%', paddingLeft: '2.5rem', height: '40px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchProducts({ search: searchQuery })}
                id="global-search-bar"
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
            <button className="btn btn-primary" style={{ height: '40px' }} onClick={() => { setActivePage('search'); fetchProducts({ search: searchQuery }); }} id="global-search-btn">
              Search
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn btn-outline btn-icon" 
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              style={{ border: 'none' }}
              title="Toggle Light/Dark Theme"
              id="theme-toggler"
            >
              {theme === 'dark' ? <Star size={18} className="stars-glow" /> : <Settings size={18} />}
            </button>

            <button 
              className="btn btn-outline" 
              onClick={() => setActivePage('chat')}
              style={{ gap: '0.5rem', background: 'rgba(0, 242, 254, 0.05)', borderColor: 'var(--border-color-glow-teal)' }}
              id="header-chat-btn"
            >
              <MessageSquare size={16} style={{ color: 'var(--color-teal)' }} />
              <span className="text-glow-teal" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-teal)' }}>Chat AI Assistant</span>
            </button>

            <button 
              className="btn btn-outline btn-icon" 
              onClick={() => setActivePage('dashboard')}
              style={{ position: 'relative' }}
              id="header-alerts-btn"
            >
              <Bell size={18} />
              {alerts.some(a => a.notified) && (
                <span style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', background: 'var(--color-danger)', borderRadius: '99px' }}></span>
              )}
            </button>
          </div>
        </header>

        {/* --- PAGE RENDERING SWITCH --- */}

        {/* 1. HOME / DISCOVER DEALS PAGE */}
        {activePage === 'home' && (
          <div id="page-home" style={{ animation: 'toastSlideIn 0.35s ease' }}>
            <div className="page-header">
              <div>
                <h1 className="page-title">Amazon Shopping Intelligence</h1>
                <p className="page-subtitle">Track price anomalies, side-by-side spec structures, and semantic AI reviews instantly.</p>
              </div>
            </div>

            {/* Banner Call to Action */}
            <div className="glass-card" style={{ padding: '2rem', display: 'flex', gap: '2rem', marginBottom: '2.5rem', background: 'linear-gradient(135deg, rgba(255,153,0,0.12) 0%, rgba(0,242,254,0.06) 100%)', border: '1px solid var(--border-color-glow)' }} id="promo-banner">
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--color-amazon)', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Premium AI Feature</span>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '0.5rem', marginBottom: '0.75rem' }}>Confused about specifications or pricing options?</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '600px' }}>
                  Ask our active chatbot **AmzAssistant**. It handles natural prompts like *&quot;Compare iPhone vs Samsung flagship devices&quot;* or *&quot;Cleanser below ₹1,500&quot;* and displays interactive visual cards immediately.
                </p>
                <button className="btn btn-primary" onClick={() => setActivePage('chat')} id="banner-chat-trigger">
                  <MessageSquare size={16} />
                  <span>Launch Live Shopping Chatbot</span>
                </button>
              </div>
              <div style={{ fontSize: '5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
            </div>

            {/* Category tabs */}
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: '700' }}>Explore Popular Smart Categories</h3>
            <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '2.5rem' }} id="category-row">
              {['Laptops', 'Mobile', 'Skincare', 'Smart Home'].map(cat => (
                <button 
                  key={cat}
                  className="btn btn-outline" 
                  style={{ gap: '0.5rem', flexShrink: 0, padding: '0.75rem 1.5rem', borderRadius: '99px' }}
                  onClick={() => handleCategoryClick(cat)}
                  id={`cat-card-${cat.toLowerCase().replace(' ', '-')}`}
                >
                  <span style={{ fontSize: '1.2rem' }}>
                    {cat === 'Laptops' ? '💻' : cat === 'Mobile' ? '📱' : cat === 'Skincare' ? '🧴' : '🗣️'}
                  </span>
                  <span style={{ fontWeight: '700' }}>{cat}</span>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>

            {/* Trending Products */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Trending Hot Price Drops 🔥</h3>
              <button className="btn btn-outline" style={{ border: 'none', color: 'var(--color-teal)' }} onClick={() => { setActivePage('search'); fetchProducts(); }} id="see-all-catalog">
                <span>View Full Catalog</span>
                <ChevronRight size={16} />
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner"></div></div>
            ) : (
              <div className="product-grid" id="trending-grid">
                {products.slice(0, 4).map(prod => (
                  <div key={prod.id} className="glass-card product-card" id={`product-home-card-${prod.id}`}>
                    <div className="prod-img-box">
                      <span>{prod.image}</span>
                      <span className="prod-tag">-{Math.round((1 - prod.price / prod.originalPrice) * 100)}% Drop</span>
                    </div>
                    <div className="prod-details">
                      <span className="prod-cat">{prod.category}</span>
                      <h4 className="prod-name" title={prod.name}>{prod.name}</h4>
                      
                      <div className="rating-bar">
                        <div style={{ display: 'flex', gap: '0.05rem' }}>
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={14} className={i < Math.floor(prod.rating) ? 'stars-glow' : ''} fill={i < Math.floor(prod.rating) ? '#ffb800' : 'none'} style={{ stroke: i < Math.floor(prod.rating) ? '#ffb800' : 'var(--text-muted)' }} />
                          ))}
                        </div>
                        <span style={{ fontWeight: '700' }}>{prod.rating}</span>
                        <span className="reviews-cnt">({prod.reviewsCount})</span>
                      </div>

                      <div className="price-row">
                        <span className="curr-price">₹{prod.price.toLocaleString()}</span>
                        <span className="orig-price">₹{prod.originalPrice.toLocaleString()}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ flex: 1, padding: '0.5rem' }} 
                          onClick={() => { setSelectedProductId(prod.id); setActivePage('detail'); }}
                          id={`view-details-${prod.id}`}
                        >
                          Details
                        </button>
                        <button 
                          className={`btn btn-outline btn-icon ${wishlist.some(w => w.id === prod.id) ? 'btn-danger' : ''}`}
                          style={{ borderColor: wishlist.some(w => w.id === prod.id) ? 'transparent' : 'var(--border-color)' }}
                          onClick={() => toggleWishlist(prod.id)}
                          id={`toggle-wish-home-${prod.id}`}
                        >
                          <Heart size={16} fill={wishlist.some(w => w.id === prod.id) ? 'white' : 'none'} />
                        </button>
                        <button 
                          className={`btn btn-outline btn-icon ${compareIds.includes(prod.id) ? 'btn-teal' : ''}`}
                          onClick={() => {
                            if (compareIds.includes(prod.id)) {
                              setCompareIds(prev => prev.filter(id => id !== prod.id));
                            } else {
                              if (compareIds.length >= 3) {
                                addToast("Limit Reached", "You can compare up to 3 products at once.", "warning");
                              } else {
                                setCompareIds(prev => [...prev, prod.id]);
                              }
                            }
                          }}
                          id={`toggle-compare-home-${prod.id}`}
                        >
                          <ArrowLeftRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. CATALOG SEARCH & ADVANCED FILTERS */}
        {activePage === 'search' && (
          <div id="page-search" style={{ animation: 'toastSlideIn 0.35s ease' }}>
            <div className="page-header">
              <div>
                <h1 className="page-title">Amazon Product Discovery Catalog</h1>
                <p className="page-subtitle">Instant filters, sort controls, and category breakdowns linked to our scrapers.</p>
              </div>
            </div>

            {/* Filter controls panel */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem' }} id="search-filter-panel">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <span className="input-label">Category Filter</span>
                  <select 
                    className="input-field select-field" 
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    id="filter-category"
                  >
                    <option value="">All Categories</option>
                    <option value="Laptops">Laptops</option>
                    <option value="Mobile">Mobiles</option>
                    <option value="Skincare">Skincare</option>
                    <option value="Smart Home">Smart Home</option>
                  </select>
                </div>

                <div className="input-group">
                  <span className="input-label">Sort By Metrics</span>
                  <select 
                    className="input-field select-field" 
                    value={searchSort}
                    onChange={(e) => setSearchSort(e.target.value)}
                    id="filter-sort"
                  >
                    <option value="rating">Highest Reviews Rating</option>
                    <option value="reviews">Total Reviews Count</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>

                <div className="input-group">
                  <span className="input-label">Min Price (₹)</span>
                  <input 
                    type="number" 
                    placeholder="Min" 
                    className="input-field"
                    value={searchMinPrice}
                    onChange={(e) => setSearchMinPrice(e.target.value)}
                    id="filter-min-price"
                  />
                </div>

                <div className="input-group">
                  <span className="input-label">Max Price (₹)</span>
                  <input 
                    type="number" 
                    placeholder="Max" 
                    className="input-field"
                    value={searchMaxPrice}
                    onChange={(e) => setSearchMaxPrice(e.target.value)}
                    id="filter-max-price"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1.25rem' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', height: '44px', gap: '0.5rem' }}
                    onClick={() => fetchProducts({
                      search: searchQuery,
                      category: searchCategory,
                      minPrice: searchMinPrice,
                      maxPrice: searchMaxPrice,
                      sortBy: searchSort
                    })}
                    id="apply-filters-btn"
                  >
                    <Filter size={16} />
                    <span>Apply Filters</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Products catalog listing */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner"></div></div>
            ) : products.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }} id="search-empty-state">
                <span style={{ fontSize: '3rem' }}>🔍</span>
                <h3 style={{ fontSize: '1.25rem', marginTop: '1rem', marginBottom: '0.5rem' }}>No Products Found</h3>
                <p style={{ color: 'var(--text-muted)' }}>Try adjusting your filters or searching for something else.</p>
                <button className="btn btn-outline" style={{ marginTop: '1.5rem' }} onClick={() => { setSearchQuery(''); setSearchCategory(''); setSearchMinPrice(''); setSearchMaxPrice(''); fetchProducts(); }} id="reset-filters-btn">
                  Reset Catalog View
                </button>
              </div>
            ) : (
              <div className="product-grid" id="search-results-grid">
                {products.map(prod => (
                  <div key={prod.id} className="glass-card product-card" id={`product-search-card-${prod.id}`}>
                    <div className="prod-img-box">
                      <span>{prod.image}</span>
                      <span className="prod-tag">-{Math.round((1 - prod.price / prod.originalPrice) * 100)}%</span>
                    </div>
                    <div className="prod-details">
                      <span className="prod-cat">{prod.category}</span>
                      <h4 className="prod-name" title={prod.name}>{prod.name}</h4>
                      
                      <div className="rating-bar">
                        <div style={{ display: 'flex', gap: '0.05rem' }}>
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={14} className={i < Math.floor(prod.rating) ? 'stars-glow' : ''} fill={i < Math.floor(prod.rating) ? '#ffb800' : 'none'} style={{ stroke: i < Math.floor(prod.rating) ? '#ffb800' : 'var(--text-muted)' }} />
                          ))}
                        </div>
                        <span style={{ fontWeight: '700' }}>{prod.rating}</span>
                        <span className="reviews-cnt">({prod.reviewsCount})</span>
                      </div>

                      <div className="price-row">
                        <span className="curr-price">₹{prod.price.toLocaleString()}</span>
                        <span className="orig-price">₹{prod.originalPrice.toLocaleString()}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ flex: 1, padding: '0.5rem' }} 
                          onClick={() => { setSelectedProductId(prod.id); setActivePage('detail'); }}
                          id={`view-details-${prod.id}`}
                        >
                          Details
                        </button>
                        <button 
                          className={`btn btn-outline btn-icon ${wishlist.some(w => w.id === prod.id) ? 'btn-danger' : ''}`}
                          style={{ borderColor: wishlist.some(w => w.id === prod.id) ? 'transparent' : 'var(--border-color)' }}
                          onClick={() => toggleWishlist(prod.id)}
                          id={`toggle-wish-search-${prod.id}`}
                        >
                          <Heart size={16} fill={wishlist.some(w => w.id === prod.id) ? 'white' : 'none'} />
                        </button>
                        <button 
                          className={`btn btn-outline btn-icon ${compareIds.includes(prod.id) ? 'btn-teal' : ''}`}
                          onClick={() => {
                            if (compareIds.includes(prod.id)) {
                              setCompareIds(prev => prev.filter(id => id !== prod.id));
                            } else {
                              if (compareIds.length >= 3) {
                                addToast("Limit Reached", "You can compare up to 3 products at once.", "warning");
                              } else {
                                setCompareIds(prev => [...prev, prod.id]);
                              }
                            }
                          }}
                          id={`toggle-compare-search-${prod.id}`}
                        >
                          <ArrowLeftRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. PRODUCT DETAILS PAGE */}
        {activePage === 'detail' && activeProduct && (
          <div id="page-detail" style={{ animation: 'toastSlideIn 0.35s ease' }}>
            <button className="btn btn-outline" style={{ marginBottom: '1.5rem', gap: '0.5rem' }} onClick={() => setActivePage('search')} id="detail-back-btn">
              <Play size={14} style={{ transform: 'rotate(180deg)' }} />
              <span>Back to Discovery Catalog</span>
            </button>

            <div className="glass-card" style={{ padding: '2rem', display: 'flex', gap: '2.5rem', flexWrap: 'wrap', marginBottom: '2.5rem' }} id="detail-main-info">
              {/* Product Big Icon */}
              <div className="glass-card" style={{ width: '280px', height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8rem', background: 'var(--bg-input)' }}>
                {activeProduct.image}
              </div>

              {/* Product Key Metadata */}
              <div style={{ flex: 1, minWidth: '320px' }}>
                <span className="prod-cat" style={{ fontSize: '0.9rem' }}>{activeProduct.brand} &bull; {activeProduct.category}</span>
                <h1 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1.2, margin: '0.5rem 0 1rem 0' }}>{activeProduct.name}</h1>
                
                <div className="rating-bar" style={{ fontSize: '1.05rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.1rem' }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={18} className={i < Math.floor(activeProduct.rating) ? 'stars-glow' : ''} fill={i < Math.floor(activeProduct.rating) ? '#ffb800' : 'none'} style={{ stroke: i < Math.floor(activeProduct.rating) ? '#ffb800' : 'var(--text-muted)' }} />
                    ))}
                  </div>
                  <span style={{ fontWeight: '800' }}>{activeProduct.rating} / 5.0</span>
                  <span className="reviews-cnt" style={{ fontSize: '0.9rem' }}>({activeProduct.reviewsCount} customer ratings)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '2rem' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-primary)' }}>₹{activeProduct.price.toLocaleString()}</span>
                  <span style={{ fontSize: '1.25rem', textDecoration: 'line-through', color: 'var(--text-muted)' }}>₹{activeProduct.originalPrice.toLocaleString()}</span>
                  <span style={{ color: 'var(--color-success)', fontWeight: '700', fontSize: '1.1rem' }}>
                    Save ₹{(activeProduct.originalPrice - activeProduct.price).toLocaleString()} ({Math.round((1 - activeProduct.price / activeProduct.originalPrice) * 100)}% off)
                  </span>
                </div>

                {/* Price tracker setup */}
                <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(255, 153, 0, 0.04)', borderColor: 'var(--border-color-glow)' }} id="detail-tracker-setup">
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bell size={18} style={{ color: 'var(--color-amazon)' }} />
                    <span>Intelligent Price Drop Alerter</span>
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Set a target budget limit below today's price. Our scraper daemon triggers notification alerts instantly if a vendor marks down this item.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        type="number" 
                        placeholder={`Target budget e.g. ₹${Math.round(activeProduct.price * 0.95)}`}
                        className="input-field"
                        style={{ width: '100%', paddingLeft: '2rem', height: '42px' }}
                        value={alertTargetPrice}
                        onChange={(e) => setAlertTargetPrice(e.target.value)}
                        id="target-price-input"
                      />
                      <DollarSign size={16} style={{ position: 'absolute', left: '10px', top: '13px', color: 'var(--text-muted)' }} />
                    </div>
                    <button 
                      className="btn btn-primary"
                      onClick={() => createPriceAlert(activeProduct.id, alertTargetPrice)}
                      id="set-alert-btn"
                    >
                      Start Tracking Price
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button 
                    className={`btn btn-outline ${wishlist.some(w => w.id === activeProduct.id) ? 'btn-danger' : ''}`}
                    onClick={() => toggleWishlist(activeProduct.id)}
                    style={{ gap: '0.5rem', flex: 1 }}
                    id="toggle-wish-detail"
                  >
                    <Heart size={16} fill={wishlist.some(w => w.id === activeProduct.id) ? 'white' : 'none'} />
                    <span>{wishlist.some(w => w.id === activeProduct.id) ? 'Saved in Wishlist' : 'Add to Wishlist'}</span>
                  </button>
                  
                  <button 
                    className={`btn btn-outline ${compareIds.includes(activeProduct.id) ? 'btn-teal' : ''}`}
                    onClick={() => {
                      if (compareIds.includes(activeProduct.id)) {
                        setCompareIds(prev => prev.filter(id => id !== activeProduct.id));
                      } else {
                        if (compareIds.length >= 3) {
                          addToast("Limit Reached", "You can compare up to 3 products at once.", "warning");
                        } else {
                          setCompareIds(prev => [...prev, activeProduct.id]);
                        }
                      }
                    }}
                    style={{ gap: '0.5rem', flex: 1 }}
                    id="toggle-compare-detail"
                  >
                    <ArrowLeftRight size={16} />
                    <span>{compareIds.includes(activeProduct.id) ? 'Compare Active' : 'Add to Compare Matrix'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Technical Specifications */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem', alignItems: 'stretch' }} id="detail-specifications-grid">
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} style={{ color: 'var(--color-teal)' }} />
                  <span>Technical Specifications</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.keys(activeProduct.specs).map(specKey => (
                    <div key={specKey} style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <span style={{ width: '150px', fontWeight: '700', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{specKey}</span>
                      <span style={{ flex: 1, fontSize: '0.9rem' }}>{activeProduct.specs[specKey]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Drop Trend SVG Line Graph */}
              <div className="glass-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={20} style={{ color: 'var(--color-amazon)' }} />
                  <span>6-Month Price Trend Log</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Automatic tracking logs from Amazon scraper fallback daemons.</p>
                
                {/* SVG Graph Drawing */}
                <div style={{ flex: 1, minHeight: '180px', position: 'relative', display: 'flex', alignItems: 'flex-end' }} id="price-trend-graph">
                  <svg viewBox="0 0 500 200" width="100%" height="100%" style={{ overflow: 'visible' }}>
                    {/* Grid lines */}
                    <line x1="50" y1="20" x2="450" y2="20" stroke="rgba(255,255,255,0.04)" />
                    <line x1="50" y1="70" x2="450" y2="70" stroke="rgba(255,255,255,0.04)" />
                    <line x1="50" y1="120" x2="450" y2="120" stroke="rgba(255,255,255,0.04)" />
                    <line x1="50" y1="170" x2="450" y2="170" stroke="rgba(255,255,255,0.08)" />
                    
                    {/* Path mapping prices */}
                    {(() => {
                      const prices = activeProduct.priceHistory.map(h => h.price);
                      const maxPrice = Math.max(...prices);
                      const minPrice = Math.min(...prices);
                      const diff = maxPrice - minPrice || 10;
                      
                      const points = activeProduct.priceHistory.map((h, i) => {
                        const x = 50 + (i * 80);
                        const y = 170 - (((h.price - minPrice) / diff) * 130);
                        return { x, y, price: h.price, date: h.date };
                      });

                      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                      return (
                        <>
                          <path 
                            d={pathD} 
                            fill="none" 
                            stroke="url(#glowGradient)" 
                            strokeWidth="3.5"
                            style={{ filter: 'drop-shadow(0px 5px 8px rgba(255,153,0,0.3))' }}
                          />
                          
                          {/* Shadow Area below path */}
                          <path 
                            d={`${pathD} L ${points[points.length-1].x} 170 L 50 170 Z`} 
                            fill="url(#areaGradient)" 
                          />

                          {/* Data Circles */}
                          {points.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="5" fill="var(--color-amazon)" stroke="#fff" strokeWidth="1.5" />
                              <text x={p.x} y={p.y - 12} fontSize="9" fontWeight="700" fill="var(--text-primary)" textAnchor="middle">₹{Math.round(p.price/1000)}K</text>
                              <text x={p.x} y="185" fontSize="9" fill="var(--text-secondary)" textAnchor="middle">{p.date}</text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                    
                    {/* Define Gradients */}
                    <defs>
                      <linearGradient id="glowGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ff9900" />
                        <stop offset="100%" stopColor="#ff5500" />
                      </linearGradient>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255, 153, 0, 0.15)" />
                        <stop offset="100%" stopColor="rgba(255, 153, 0, 0.0)" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>

            {/* AI Review Analyzer & Sentiment */}
            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2.5rem' }} id="review-analyzer-block">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={20} style={{ color: 'var(--color-teal)' }} />
                <span>AI Review Sentiment & Integrity Analyzer</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>We evaluate hundreds of reviews for positive bias, keyword repetitions, and verify seller manipulation indicators.</p>

              <div className="sentiment-container">
                {/* SVG Gauge drawing positive/negative split */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  
                  {/* Gauge Arc */}
                  <div style={{ position: 'relative', width: '160px', height: '100px', display: 'flex', justifyContent: 'center' }} id="sentiment-gauge">
                    <svg width="160" height="100" viewBox="0 0 160 100">
                      {/* Grey Base */}
                      <path d="M 10 90 A 70 70 0 0 1 150 90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" strokeLinecap="round" />
                      {/* Positive Arc */}
                      <path 
                        d="M 10 90 A 70 70 0 0 1 150 90" 
                        fill="none" 
                        stroke="url(#sentimentGrad)" 
                        strokeWidth="16" 
                        strokeLinecap="round"
                        strokeDasharray="220"
                        strokeDashoffset={220 - (220 * (activeProduct.sentimentAnalysis.positive / 100))}
                      />
                      {/* Score display inside */}
                      <text x="80" y="80" fontSize="24" fontWeight="800" fill="var(--text-primary)" textAnchor="middle">{activeProduct.sentimentAnalysis.positive}%</text>
                      <text x="80" y="95" fontSize="10" fontWeight="600" fill="var(--text-muted)" textAnchor="middle">Positive Ratio</text>
                      
                      <defs>
                        <linearGradient id="sentimentGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#e94057" />
                          <stop offset="50%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#38ef7d" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  <div>
                    <h4 style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>Customer Review Highlights</h4>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-success)' }}>{activeProduct.sentimentAnalysis.positive}%</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Positive Sentiment</span>
                      </div>
                      <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                      <div>
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-danger)' }}>{activeProduct.sentimentAnalysis.negative}%</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Negative Complaints</span>
                      </div>
                      <div style={{ borderRight: '1px solid var(--border-color)' }}></div>
                      <div>
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: '800', color: activeProduct.sentimentAnalysis.fakeReviewProbability > 15 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                          {activeProduct.sentimentAnalysis.fakeReviewProbability}%
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fake Review Probability</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Keyword Cloud representation */}
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Parsed Semantic Keywords</h4>
                  <div className="keyword-cloud">
                    {activeProduct.sentimentAnalysis.keywordCloud.map((word, i) => (
                      <span 
                        key={i} 
                        className="cloud-word" 
                        style={{ 
                          fontSize: `${0.85 + (word.value / 150)}rem`,
                          borderColor: word.value > 70 ? 'var(--border-color-glow-teal)' : 'var(--border-color)',
                          color: word.value > 70 ? 'var(--color-teal)' : 'var(--text-primary)'
                        }}
                      >
                        {word.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Core pros and cons lists */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }} id="pros-cons-grid">
                <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '12px', padding: '1.25rem' }}>
                  <h4 style={{ color: 'var(--color-success)', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Check size={16} />
                    <span>Extracted Pros highlights</span>
                  </h4>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                    {activeProduct.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                  </ul>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '12px', padding: '1.25rem' }}>
                  <h4 style={{ color: 'var(--color-danger)', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <X size={16} />
                    <span>Extracted Cons complaints</span>
                  </h4>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                    {activeProduct.cons.map((con, i) => <li key={i}>{con}</li>)}
                  </ul>
                </div>
              </div>
            </div>

            {/* Real Customer Comments list */}
            <div className="glass-card" style={{ padding: '2rem' }} id="review-comments-block">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem' }}>Recent Analyzed Customer Reviews</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {activeProduct.reviews.map((rev, i) => (
                  <div key={i} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="chat-avatar avatar-bg-green" style={{ width: '28px', height: '28px', fontSize: '0.85rem' }}>
                          {rev.user[0]}
                        </div>
                        <div>
                          <span style={{ fontWeight: '700', fontSize: '0.9rem', display: 'block' }}>{rev.user}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rev.date}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {rev.verified && (
                          <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '700' }}>
                            Verified Purchase
                          </span>
                        )}
                        <div style={{ display: 'flex' }}>
                          {[...Array(5)].map((_, starI) => (
                            <Star key={starI} size={12} fill={starI < rev.rating ? '#ffb800' : 'none'} style={{ stroke: starI < rev.rating ? '#ffb800' : 'var(--text-muted)' }} />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>&ldquo;{rev.text}&rdquo;</p>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '0.1rem 0.4rem', 
                        borderRadius: '4px', 
                        fontWeight: '700', 
                        background: rev.sentiment === 'positive' ? 'rgba(16,185,129,0.1)' : rev.sentiment === 'negative' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                        color: rev.sentiment === 'positive' ? 'var(--color-success)' : rev.sentiment === 'negative' ? 'var(--color-danger)' : 'var(--text-secondary)'
                      }}>
                        Sentiment: {rev.sentiment.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. PRODUCT COMPARISON ENGINE */}
        {activePage === 'compare' && (
          <div id="page-compare" style={{ animation: 'toastSlideIn 0.35s ease' }}>
            <div className="page-header">
              <div>
                <h1 className="page-title">Product Comparison Matrix</h1>
                <p className="page-subtitle">Side-by-side spec comparison, radar values scoring, and AI highlights analysis.</p>
              </div>
              {compareIds.length > 0 && (
                <button className="btn btn-outline" style={{ color: 'var(--color-danger)' }} onClick={() => setCompareIds([])} id="clear-compare-matrix">
                  Clear Matrix
                </button>
              )}
            </div>

            {compareIds.length === 0 ? (
              <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }} id="compare-empty-state">
                <span style={{ fontSize: '3.5rem' }}>⚖️</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '1rem', marginBottom: '0.5rem' }}>Comparison Matrix is Empty</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                  Select up to three items in the product catalog, or ask our AI assistant to load products directly here.
                </p>
                <button className="btn btn-primary" onClick={() => { setActivePage('search'); fetchProducts(); }} id="add-items-compare-btn">
                  Browse Catalog Items
                </button>
              </div>
            ) : (
              (() => {
                const compProds = products.filter(p => compareIds.includes(p.id));
                
                // Extract all unique spec keys across compared products
                const allSpecKeys = Array.from(new Set(
                  compProds.flatMap(p => Object.keys(p.specs))
                ));

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} id="compare-matrix-loaded">
                    {/* Comparison specs grid */}
                    <div className="compare-matrix-wrapper">
                      <table className="compare-table">
                        <thead>
                          <tr>
                            <th>Key Attributes</th>
                            {compProds.map(prod => (
                              <td key={prod.id} className="compare-header-cell" style={{ borderLeft: '1px solid var(--border-color)', width: `${80 / compProds.length}%` }}>
                                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>{prod.image}</span>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', lineHeight: '1.3' }}>{prod.name}</h3>
                                <span className="prod-cat" style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{prod.brand}</span>
                                
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                                  <Star size={12} fill="#ffb800" stroke="#ffb800" />
                                  <span style={{ fontWeight: '700' }}>{prod.rating}</span>
                                  <span className="reviews-cnt">({prod.reviewsCount})</span>
                                </div>

                                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>₹{prod.price.toLocaleString()}</div>
                                <button className="compare-remove-btn" onClick={() => setCompareIds(prev => prev.filter(id => id !== prod.id))} id={`remove-compare-${prod.id}`}>
                                  Remove
                                </button>
                              </td>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <th>Category Type</th>
                            {compProds.map(prod => (
                              <td key={prod.id} style={{ borderLeft: '1px solid var(--border-color)', fontWeight: '700', fontSize: '0.9rem', color: 'var(--color-teal)' }}>
                                {prod.category}
                              </td>
                            ))}
                          </tr>
                          
                          {/* Render specifications */}
                          {allSpecKeys.map(specKey => (
                            <tr key={specKey}>
                              <th>{specKey}</th>
                              {compProds.map(prod => (
                                <td key={prod.id} style={{ borderLeft: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {prod.specs[specKey] || <span style={{ color: 'var(--text-muted)' }}>Not Listed</span>}
                                </td>
                              ))}
                            </tr>
                          ))}

                          {/* Pros & Cons summary inside compare */}
                          <tr>
                            <th>Parsed Pros Highlights</th>
                            {compProds.map(prod => (
                              <td key={prod.id} style={{ borderLeft: '1px solid var(--border-color)' }}>
                                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--color-success)' }}>
                                  {prod.pros.slice(0, 3).map((pro, i) => <li key={i}>{pro}</li>)}
                                </ul>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <th>Parsed Cons Complaints</th>
                            {compProds.map(prod => (
                              <td key={prod.id} style={{ borderLeft: '1px solid var(--border-color)' }}>
                                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--color-danger)' }}>
                                  {prod.cons.slice(0, 3).map((con, i) => <li key={i}>{con}</li>)}
                                </ul>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* AI Scoring Radar Feature Simulation */}
                    <div className="glass-card" style={{ padding: '2rem' }} id="compare-ai-summary">
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageSquare size={20} style={{ color: 'var(--color-teal)' }} />
                        <span>AI Value Comparison Report</span>
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Synthetic analytical summary powered by NLP models and rating trends.</p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {compProds.map(prod => (
                          <div key={prod.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '1.5rem' }}>{prod.image}</span>
                              <h4 style={{ fontWeight: '800', fontSize: '1rem' }}>{prod.brand} Value Evaluation</h4>
                            </div>
                            
                            {/* Score bars mapping specs features */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                  <span>Review Sentiment Value</span>
                                  <span style={{ fontWeight: '700' }}>{prod.sentimentAnalysis.positive}/100</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '99px', overflow: 'hidden' }}>
                                  <div style={{ width: `${prod.sentimentAnalysis.positive}%`, height: '100%', background: 'var(--grad-success)' }}></div>
                                </div>
                              </div>

                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                  <span>Review Integrity Check (Higher is safer)</span>
                                  <span style={{ fontWeight: '700' }}>{100 - prod.sentimentAnalysis.fakeReviewProbability}/100</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '99px', overflow: 'hidden' }}>
                                  <div style={{ width: `${100 - prod.sentimentAnalysis.fakeReviewProbability}%`, height: '100%', background: 'var(--grad-teal)' }}></div>
                                </div>
                              </div>

                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                  <span>Deal Discount Index</span>
                                  <span style={{ fontWeight: '700' }}>{Math.round((1 - prod.price/prod.originalPrice)*100)}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '99px', overflow: 'hidden' }}>
                                  <div style={{ width: `${(1 - prod.price/prod.originalPrice)*150}%`, height: '100%', background: 'var(--grad-amazon)' }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* 5. AI shopping chatbot panel */}
        {activePage === 'chat' && (
          <div id="page-chat" style={{ animation: 'toastSlideIn 0.35s ease' }}>
            <div className="page-header">
              <div>
                <h1 className="page-title">AI Shopping Companion</h1>
                <p className="page-subtitle">NLP query understanding. Budget planning, side-by-side specs compares, and search advice.</p>
              </div>
            </div>

            <div className="glass-card chat-wrapper" id="chat-panel-container">
              {/* Messages viewport */}
              <div className="chat-box" id="chat-messages-box">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`chat-msg ${msg.sender === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`} id={`chat-msg-${msg.id}`}>
                    <div className={`chat-avatar ${msg.sender === 'user' ? 'avatar-bg-gold' : 'avatar-bg-green'}`} style={{ background: msg.sender === 'user' ? 'var(--grad-amazon)' : 'var(--grad-teal)', color: msg.sender === 'user' ? 'white' : '#0b0b0f' }}>
                      {msg.sender === 'user' ? <User size={16} /> : '🤖'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '85%' }}>
                      <div className="chat-bubble">
                        {msg.text}
                      </div>

                      {/* Render attached product cards if returned by chatbot */}
                      {msg.products && msg.products.length > 0 && (
                        <div className="chat-attachment-grid" id={`chat-attach-grid-${msg.id}`}>
                          {msg.products.map(prod => (
                            <div key={prod.id} className="glass-card chat-attachment-card" id={`chat-attach-card-${prod.id}`}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '1.75rem' }}>{prod.image}</span>
                                <div style={{ overflow: 'hidden' }}>
                                  <h4 title={prod.name}>{prod.name}</h4>
                                  <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '0.8rem' }}>₹{prod.price.toLocaleString()}</span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
                                <button 
                                  className="btn btn-outline" 
                                  style={{ flex: 1, padding: '0.25rem', fontSize: '0.7rem' }}
                                  onClick={() => { setSelectedProductId(prod.id); setActivePage('detail'); }}
                                  id={`attach-details-${prod.id}`}
                                >
                                  Details
                                </button>
                                <button 
                                  className="btn btn-outline btn-icon"
                                  style={{ width: '28px', height: '28px', padding: 0 }}
                                  onClick={() => {
                                    if (compareIds.includes(prod.id)) {
                                      addToast("Matrix updated", "Item removed", "warning");
                                      setCompareIds(prev => prev.filter(id => id !== prod.id));
                                    } else {
                                      if (compareIds.length >= 3) {
                                        addToast("Limit Reached", "Limit comparison is 3", "warning");
                                      } else {
                                        setCompareIds(prev => [...prev, prod.id]);
                                        addToast("Added to Matrix", "You can check specifications in comparison screen!", "success");
                                      }
                                    }
                                  }}
                                  id={`attach-compare-${prod.id}`}
                                >
                                  <ArrowLeftRight size={10} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing status */}
                {chatTyping && (
                  <div className="chat-msg chat-msg-bot" id="chat-typing-bubble">
                    <div className="chat-avatar avatar-bg-green" style={{ background: 'var(--grad-teal)', color: '#0b0b0f' }}>🤖</div>
                    <div className="chat-bubble" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', padding: '0.75rem 1rem' }}>
                      <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }}></div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>AmzAssistant is analyzing pricing databases...</span>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Console */}
              <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div className="chat-input-row">
                  <input 
                    type="text" 
                    placeholder="Ask AI: 'Compare iPhone vs Samsung' or 'Laptop under 150000'..." 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitChatMessage()}
                    id="chat-text-input"
                  />
                  <button 
                    className="btn btn-primary btn-icon"
                    onClick={() => submitChatMessage()}
                    id="send-chat-btn"
                  >
                    <Send size={16} />
                  </button>
                </div>

                {/* Suggested Quick Prompts */}
                <div className="chat-suggested-prompts" id="chat-quick-suggestions">
                  {[
                    "Best gaming laptop under ₹1,50,000",
                    "Compare iPhone vs Samsung",
                    "Best skincare for dry skin",
                    "Gentle cleanser under ₹1,500"
                  ].map((promptText, i) => (
                    <span 
                      key={i} 
                      className="suggest-tag" 
                      onClick={() => submitChatMessage(promptText)}
                      id={`suggest-tag-${i}`}
                    >
                      {promptText}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. USER PROFILE & WISHLIST DASHBOARD */}
        {activePage === 'dashboard' && (
          <div id="page-dashboard" style={{ animation: 'toastSlideIn 0.35s ease' }}>
            <div className="page-header">
              <div>
                <h1 className="page-title">My Trackers & Wishlist</h1>
                <p className="page-subtitle">Track active price drops, manage notifications, and view saved items.</p>
              </div>
            </div>

            {/* Price Alert Monitors list */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} style={{ color: 'var(--color-amazon)' }} />
              <span>Active Price drop Monitors</span>
            </h3>

            {alerts.length === 0 ? (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2.5rem' }} id="alerts-empty-state">
                <p style={{ color: 'var(--text-muted)' }}>You are not tracking any products yet. Go to any product's details page to set price alerts.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }} id="alerts-monitors-list">
                {alerts.map(alert => (
                  <div key={alert.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderLeft: alert.notified ? '4px solid var(--color-success)' : '1px solid var(--border-color)' }} id={`alert-item-card-${alert.id}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '240px' }}>
                      <span style={{ fontSize: '2.5rem' }}>{alert.product.image}</span>
                      <div>
                        <h4 style={{ fontWeight: '800', fontSize: '1rem', lineHeight: '1.4' }}>{alert.product.name}</h4>
                        <span className="prod-cat" style={{ fontSize: '0.75rem' }}>{alert.product.category}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Today's Price</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: '800', color: alert.notified ? 'var(--color-success)' : 'var(--text-primary)' }}>₹{alert.product.price.toLocaleString()}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Limit</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--color-amazon)' }}>₹{alert.targetPrice.toLocaleString()}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Alert Status</span>
                        {alert.notified ? (
                          <span style={{ color: 'var(--color-success)', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Check size={14} /> Price Reached!
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-teal)', fontWeight: '700', fontSize: '0.85rem' }}>Active checks...</span>
                        )}
                      </div>
                    </div>

                    <button className="btn btn-outline" style={{ color: 'var(--color-danger)', padding: '0.5rem 1rem' }} onClick={() => removePriceAlert(alert.id)} id={`delete-alert-${alert.id}`}>
                      Delete Tracker
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Wishlist Grid */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Heart size={20} style={{ color: 'var(--color-danger)' }} />
              <span>Saved Shopping Wishlist</span>
            </h3>

            {wishlist.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }} id="wishlist-empty-state">
                <span style={{ fontSize: '2.5rem' }}>❤️</span>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Your saved wishlist is empty. Add items from details page or chatbot recommendation bubbles.</p>
              </div>
            ) : (
              <div className="product-grid" id="wishlist-grid">
                {wishlist.map(prod => (
                  <div key={prod.id} className="glass-card product-card" id={`product-wishlist-card-${prod.id}`}>
                    <div className="prod-img-box">
                      <span>{prod.image}</span>
                      <span className="prod-tag">-{Math.round((1 - prod.price / prod.originalPrice) * 100)}%</span>
                    </div>
                    <div className="prod-details">
                      <span className="prod-cat">{prod.category}</span>
                      <h4 className="prod-name" title={prod.name}>{prod.name}</h4>
                      
                      <div className="price-row">
                        <span className="curr-price">₹{prod.price.toLocaleString()}</span>
                        <span className="orig-price">₹{prod.originalPrice.toLocaleString()}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ flex: 1, padding: '0.5rem' }} 
                          onClick={() => { setSelectedProductId(prod.id); setActivePage('detail'); }}
                          id={`view-details-${prod.id}`}
                        >
                          Details
                        </button>
                        <button 
                          className="btn btn-outline btn-icon btn-danger"
                          style={{ borderColor: 'transparent' }}
                          onClick={() => toggleWishlist(prod.id)}
                          id={`remove-wish-${prod.id}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. ADMIN TELEMETRY & DEVELOPER ACTION CENTER */}
        {activePage === 'admin' && (
          <div id="page-admin" style={{ animation: 'toastSlideIn 0.35s ease' }}>
            <div className="page-header">
              <div>
                <h1 className="page-title">System Telemetry & Telemetries</h1>
                <p className="page-subtitle">Verify logs stream, background workers, and try developer simulated actions.</p>
              </div>
            </div>

            {/* Developer Testing actions banner */}
            <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '2.5rem', borderLeft: '4px solid var(--color-teal)' }} id="developer-tools-panel">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-teal)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={18} />
                <span>Developer Sandbox Console</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Simulate background operations on Windows locally. Trigger a mock price drop event on a selected product to witness real-time background cron alerting toasts instantly!
              </p>
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => triggerPriceDropEvent('prod-iphone-15-pro', 15000)}
                  style={{ gap: '0.5rem' }}
                  id="dev-drop-iphone"
                >
                  <Play size={16} />
                  <span>Drop iPhone Price by ₹15,000</span>
                </button>

                <button 
                  className="btn btn-primary"
                  onClick={() => triggerPriceDropEvent('prod-macbook-air-m3', 10000)}
                  style={{ gap: '0.5rem', background: 'var(--grad-teal)', color: '#0b0b0f' }}
                  id="dev-drop-macbook"
                >
                  <Play size={16} />
                  <span>Drop MacBook Price by ₹10,000</span>
                </button>

                <button 
                  className="btn btn-outline"
                  onClick={triggerResetEvent}
                  style={{ gap: '0.5rem' }}
                  id="dev-reset-prices"
                >
                  <RefreshCw size={16} />
                  <span>Reset Prices & Notifications</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="glass-card stat-card" id="admin-stat-1">
                <div className="stat-icon-wrapper"><Activity size={24} /></div>
                <div>
                  <span className="stat-lbl">API Server Health</span>
                  <div className="stat-val text-glow-amazon">99.98%</div>
                </div>
              </div>
              <div className="glass-card stat-card" id="admin-stat-2">
                <div className="stat-icon-wrapper stat-icon-teal"><Activity size={24} /></div>
                <div>
                  <span className="stat-lbl">Response Delay</span>
                  <div className="stat-val text-glow-teal">85ms</div>
                </div>
              </div>
              <div className="glass-card stat-card" id="admin-stat-3">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-success)' }}><Star size={24} /></div>
                <div>
                  <span className="stat-lbl">Rate limit index</span>
                  <div className="stat-val" style={{ color: 'var(--color-success)' }}>Secure OK</div>
                </div>
              </div>
            </div>

            {/* Console Log stream stream */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} style={{ color: 'var(--color-amazon)' }} />
              <span>Live Express Server Action Stream Logs</span>
            </h3>

            <div className="console-box" id="admin-logs-console">
              {logs.length === 0 ? (
                <div className="console-line">No system activity captured yet...</div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="console-line" id={`console-line-${log.id}`}>
                    <span className="console-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={`console-tag ${log.type === 'System' ? 'console-tag-sys' : log.type === 'API' ? 'console-tag-api' : log.type === 'Alert' ? 'console-tag-alr' : 'console-tag-cht'}`}>
                      {log.type.toUpperCase()}
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* --- AUTH MODAL OVERLAY --- */}
      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} id="auth-modal-overlay">
          <div className="glass-card" style={{ width: '420px', padding: '2rem', position: 'relative' }} id="auth-modal-content">
            <button 
              className="btn btn-outline btn-icon" 
              style={{ position: 'absolute', right: '16px', top: '16px', border: 'none' }}
              onClick={() => setShowAuthModal(false)}
              id="close-auth-modal"
            >
              <X size={18} />
            </button>

            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
              {authMode === 'login' ? 'Welcome Back' : 'Create Sandbox Account'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {authMode === 'login' ? 'Sign in to access price drops alerts.' : 'Initialize credentials to track budgets.'}
            </p>

            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--color-danger)', marginBottom: '1rem' }} id="auth-error-box">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} id="auth-submit-form">
              <div className="input-group">
                <span className="input-label">Username</span>
                <input 
                  type="text" 
                  className="input-field" 
                  required
                  placeholder="e.g. guest"
                  value={authForm.username}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                  id="auth-username-field"
                />
              </div>

              <div className="input-group">
                <span className="input-label">Password</span>
                <input 
                  type="password" 
                  className="input-field" 
                  required
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  id="auth-password-field"
                />
              </div>

              {authMode === 'register' && (
                <>
                  <div className="input-group">
                    <span className="input-label">Name</span>
                    <input 
                      type="text" 
                      className="input-field" 
                      required
                      placeholder="e.g. John Doe"
                      value={authForm.name}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                      id="auth-name-field"
                    />
                  </div>

                  <div className="input-group">
                    <span className="input-label">Email</span>
                    <input 
                      type="email" 
                      className="input-field" 
                      required
                      placeholder="e.g. john@doe.com"
                      value={authForm.email}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                      id="auth-email-field"
                    />
                  </div>

                  <div className="input-group">
                    <span className="input-label">Initial Sandbox Budget (₹)</span>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={authForm.budget}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, budget: e.target.value }))}
                      id="auth-budget-field"
                    />
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', height: '44px' }} id="auth-action-btn">
                {authMode === 'login' ? 'Sign In' : 'Register & Start'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem' }}>
              {authMode === 'login' ? (
                <p style={{ color: 'var(--text-secondary)' }}>
                  Don't have an account?{' '}
                  <button className="btn btn-outline" style={{ border: 'none', padding: '0 0.25rem', color: 'var(--color-amazon)', fontWeight: '700' }} onClick={() => setAuthMode('register')} id="switch-auth-register">
                    Register Here
                  </button>
                </p>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>
                  Already have an account?{' '}
                  <button className="btn btn-outline" style={{ border: 'none', padding: '0 0.25rem', color: 'var(--color-amazon)', fontWeight: '700' }} onClick={() => setAuthMode('login')} id="switch-auth-login">
                    Sign In Here
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
