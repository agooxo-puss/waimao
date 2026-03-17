import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useParams, Link, useNavigate } from 'react-router-dom'
import './App.css'

const supabaseUrl = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co'
const supabaseKey = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_'

const ADMIN_USER = 'waimao'
const ADMIN_PASS = 'waimao123'

const categoryNames = {
  world: "國際",
  tech: "科技",
  sports: "體育",
  culture: "文化",
  business: "香港",
  macaodaily: "澳門"
}

function getImage(article) {
  if (article.image) return article.image
  return ''
}

function LoginModal({ onLogin, onClose }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      onLogin()
    } else {
      setError('❌ 用戶名或密碼錯誤')
    }
  }

  return (
    <div className="admin-overlay">
      <div className="login-panel">
        <div className="login-header">
          <h2>🔐 管理員登入</h2>
          <button className="admin-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用戶名</label>
            <input 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="輸入用戶名" 
            />
          </div>
          <div className="form-group">
            <label>密碼</label>
            <input 
              type="password"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="輸入密碼" 
            />
          </div>
          {error && <p className="message" style={{ color: 'red' }}>{error}</p>}
          <button type="submit" className="submit-btn">登入</button>
        </form>
      </div>
    </div>
  )
}

function AdminPanel({ onClose, onRefresh, articles, setArticles }) {
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('world')
  const [author, setAuthor] = useState('')
  const [image, setImage] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('publish')
  const [editingId, setEditingId] = useState(null)

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('圖片不能超過 5MB')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setImage(reader.result)
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const today = new Date()
    const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`

    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          title,
          excerpt,
          content,
          category,
          author: author || '歪貓編輯',
          date: dateStr,
          image: image || null
        })
      })

      if (res.ok) {
        setMessage('✅ 文章發布成功！')
        setTitle('')
        setExcerpt('')
        setContent('')
        setAuthor('')
        setImage('')
        onRefresh()
      } else {
        setMessage('❌ 發布失敗')
      }
    } catch (err) {
      setMessage('❌ 錯誤：' + err.message)
    }

    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('確定要刪除這篇文章嗎？')) return
    
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/articles?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      })
      
      if (res.ok) {
        setArticles(articles.filter(a => a.id !== id))
        alert('✅ 刪除成功！')
      } else {
        alert('❌ 刪除失敗')
      }
    } catch (err) {
      alert('❌ 錯誤：' + err.message)
    }
  }

  const handleEdit = (article) => {
    setEditingId(article.id)
    setTitle(article.title || '')
    setExcerpt(article.excerpt || '')
    setContent(article.content || '')
    setCategory(article.category || 'world')
    setAuthor(article.author || '')
    setImage(article.image || '')
    setImagePreview(article.image || null)
    setActiveTab('publish')
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/articles?id=eq.${editingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          title,
          excerpt,
          content,
          category,
          author: author || '歪貓編輯',
          image: image || null
        })
      })

      if (res.ok) {
        setMessage('✅ 文章更新成功！')
        setEditingId(null)
        setTitle('')
        setExcerpt('')
        setContent('')
        setAuthor('')
        setImage('')
        setImagePreview(null)
        onRefresh()
      } else {
        setMessage('❌ 更新失敗')
      }
    } catch (err) {
      setMessage('❌ 錯誤：' + err.message)
    }

    setLoading(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setTitle('')
    setExcerpt('')
    setContent('')
    setAuthor('')
    setImage('')
    setImagePreview(null)
  }

  return (
    <div className="admin-overlay">
      <div className="admin-panel">
        <div className="admin-header">
          <h2>⚙️ 管理後台</h2>
          <button className="admin-close" onClick={onClose}>×</button>
        </div>
        
        <div className="admin-tabs">
          <button 
            className={`admin-tab ${activeTab === 'publish' ? 'active' : ''}`}
            onClick={() => setActiveTab('publish')}
          >
            📝 發布文章
          </button>
          <button 
            className={`admin-tab ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            🗑️ 管理文章
          </button>
        </div>

        {activeTab === 'publish' && (
          <form onSubmit={editingId ? handleUpdate : handleSubmit}>
            {editingId && (
              <div className="edit-banner">
                ✏️ 編輯文章中...
                <button type="button" onClick={cancelEdit} className="cancel-edit">取消</button>
              </div>
            )}
            <div className="form-group">
              <label>標題 *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="輸入文章標題" />
            </div>
            <div className="form-group">
              <label>摘要</label>
              <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="輸入文章摘要" rows={2} />
            </div>
            <div className="form-group">
              <label>內容 (HTML)</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="<p>文章內容...</p>" rows={4} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>分類</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="world">國際</option>
                  <option value="tech">科技</option>
                  <option value="sports">體育</option>
                  <option value="culture">文化</option>
                  <option value="business">香港</option>
                  <option value="macaodaily">澳門</option>
                </select>
              </div>
              <div className="form-group">
                <label>作者</label>
                <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="作者名稱" />
              </div>
            </div>
            <div className="form-group">
              <label>圖片 URL</label>
              <input 
                type="text" 
                value={image} 
                onChange={e => { setImage(e.target.value); setImagePreview(e.target.value || null); }} 
                placeholder="輸入圖片網址或上傳文件" 
              />
            </div>
            <div className="form-group">
              <label>或上傳圖片</label>
              <input type="file" accept="image/*" onChange={handleImageChange} className="file-input" />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="預覽" />
                  <button type="button" className="remove-image" onClick={() => { setImage(''); setImagePreview(null) }}>×</button>
                </div>
              )}
            </div>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (editingId ? '更新中...' : '發布中...') : (editingId ? '💾 更新文章' : '🚀 發布文章')}
            </button>
            {message && <p className="message">{message}</p>}
          </form>
        )}

        {activeTab === 'manage' && (
          <div className="article-list">
            {articles.map(article => (
              <div key={article.id} className="article-item">
                <div className="article-info">
                  <span className="article-title">{article.title}</span>
                  <span className="article-meta">{article.author} · {article.date}</span>
                </div>
                <div className="article-actions">
                  <button 
                    className="edit-btn"
                    onClick={() => handleEdit(article)}
                  >
                    ✏️ 編輯
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDelete(article.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HomePage() {
  const { category, page } = useParams()
  const [articles, setArticles] = useState([])
  const [currentCategory, setCurrentCategory] = useState(category || "all")
  const [currentPage, setCurrentPage] = useState(parseInt(page) || 1)
  const [displayCount, setDisplayCount] = useState(12)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setCurrentCategory(category || "all")
  }, [category])

  useEffect(() => {
    setCurrentPage(parseInt(page) || 1)
  }, [page])

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/articles?order=created_at.desc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      })
      const data = await res.json()
      setArticles(data || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchArticles()
  }, [])

  useEffect(() => {
    setDisplayCount(12)
  }, [currentCategory])

  const handleAdminClick = () => {
    if (isLoggedIn) {
      setShowAdmin(true)
    } else {
      setShowAdmin('login')
    }
  }

  const filteredArticles = currentCategory === "all" 
    ? articles 
    : articles.filter(a => a.category === currentCategory)

  const displayedArticles = filteredArticles.slice(0, displayCount)

  const loadMore = () => {
    setDisplayCount(prev => prev + 12)
  }

  const selectCategory = (cat) => {
    setCurrentCategory(cat)
    if (cat === "all") {
      navigate("/")
    } else {
      navigate(`/category/${cat}`)
    }
  }

  const isAdminSite = typeof window !== 'undefined' && window.location.hostname.includes('waimao')

  return (
    <>
      <header>
        <div className="header-inner">
          <a href="#" className="logo">歪貓娛樂</a>
          {isAdminSite && (
            <nav>
              <a href="#" className="active">首頁</a>
              <a href="#" onClick={(e) => { e.preventDefault(); handleAdminClick() }}>管理</a>
            </nav>
          )}
          {isAdminSite && (
            <button className="admin-btn" onClick={handleAdminClick}>⚙️ 管理</button>
          )}
        </div>
      </header>

      <main>
        {loading ? (
          <div className="loading">載入中...</div>
        ) : articles.length > 0 ? (
          <>
            <section className="hero" onClick={() => navigate(`/article/${articles[0].id}`)}>
              <img src={getImage(articles[0])} alt="Featured" className="hero-image" />
              <div className="hero-overlay"></div>
              <div className="hero-content">
                <span className="hero-badge">頭條</span>
                <h1 className="hero-title">{articles[0].title}</h1>
                <p className="hero-excerpt">{articles[0].excerpt}</p>
                <div className="hero-meta">
                  <span>{articles[0].author}</span>
                  <span>·</span>
                  <span>{articles[0].date}</span>
                </div>
              </div>
            </section>

            <section className="categories">
              <div className="categories-inner container">
                <button 
                  className={`category-tab ${currentCategory === "all" ? "active" : ""}`}
                  onClick={() => selectCategory("all")}
                >
                  全部
                </button>
                <button 
                  className={`category-tab ${currentCategory === "world" ? "active" : ""}`}
                  onClick={() => selectCategory("world")}
                >
                  國際
                </button>
                <button 
                  className={`category-tab ${currentCategory === "tech" ? "active" : ""}`}
                  onClick={() => selectCategory("tech")}
                >
                  科技
                </button>
                <button 
                  className={`category-tab ${currentCategory === "sports" ? "active" : ""}`}
                  onClick={() => selectCategory("sports")}
                >
                  體育
                </button>
                <button 
                  className={`category-tab ${currentCategory === "culture" ? "active" : ""}`}
                  onClick={() => selectCategory("culture")}
                >
                  文化
                </button>
                <button 
                  className={`category-tab ${currentCategory === "business" ? "active" : ""}`}
                  onClick={() => selectCategory("business")}
                >
                  香港
                </button>
                <button 
                  className={`category-tab ${currentCategory === "macaodaily" ? "active" : ""}`}
                  onClick={() => selectCategory("macaodaily")}
                >
                  澳門
                </button>
              </div>
            </section>

            <section className="news-section container">
              <h2 className="section-title">
                {currentCategory === "all" ? "最新消息" : categoryNames[currentCategory]}
              </h2>
              <div className="news-grid">
                {displayedArticles.map((article) => (
                  <article 
                    key={article.id} 
                    className="news-card"
                    onClick={() => navigate(`/article/${article.id}`)}
                  >
                    <div className="card-image">
                      <img src={getImage(article)} alt={article.title} loading="lazy" />
                      <span className="card-badge">{categoryNames[article.category]}</span>
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">{article.title}</h3>
                      <p className="card-excerpt">{article.excerpt}</p>
                      <div className="card-meta">
                        <div className="avatar">{article.author?.[0] || '編'}</div>
                        <span className="author">{article.author}</span>
                        <span>·</span>
                        <span>{article.date}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              
              {displayedArticles.length < filteredArticles.length && (
                <div className="load-more-container">
                  <button className="load-more-btn" onClick={loadMore}>
                    載入更多 ({filteredArticles.length - displayedArticles.length} 篇)
                  </button>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="container" style={{ padding: '100px 20px', textAlign: 'center' }}>
            <h2>尚無文章</h2>
            <p>點擊上方「管理」按鈕發布第一篇文章！</p>
          </div>
        )}
      </main>

      <footer>
        <div className="container footer-content">
          <div className="footer-logo">歪貓娛樂</div>
          <div className="footer-links">
            <a href="#">關於</a>
            <a href="#">聯絡</a>
            <a href="#">隱私</a>
          </div>
          <p className="footer-copy">© 2026 歪貓娛樂. All rights reserved.</p>
        </div>
      </footer>

      {selectedArticle && (
        <>
          <div className="modal-overlay active" onClick={() => setSelectedArticle(null)}></div>
          <div className="modal active">
            <button className="modal-close" onClick={() => setSelectedArticle(null)}>×</button>
            <img src={selectedArticle.image} alt="" className="modal-image" />
            <div className="modal-content">
              <h2 className="modal-title">{selectedArticle.title}</h2>
              <div className="modal-meta">
                <div className="avatar">{selectedArticle.author?.[0] || '編'}</div>
                <div>
                  <div className="author">{selectedArticle.author}</div>
                  <div className="modal-date">{selectedArticle.date}</div>
                </div>
              </div>
              <div className="modal-body" dangerouslySetInnerHTML={{ __html: selectedArticle.content }}></div>
            </div>
          </div>
        </>
      )}

      {showAdmin === 'login' && (
        <LoginModal 
          onLogin={() => { setIsLoggedIn(true); setShowAdmin(true) }} 
          onClose={() => setShowAdmin(false)} 
        />
      )}

      {showAdmin === true && (
        <AdminPanel 
          onClose={() => setShowAdmin(false)} 
          onRefresh={fetchArticles}
          articles={articles}
          setArticles={setArticles}
        />
      )}
    </>
  )
}

function ArticlePage() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [related, setRelated] = useState([])
  
  useEffect(() => {
    async function fetchArticle() {
      setLoading(true)
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/articles?id=eq.${id}`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        })
        const data = await res.json()
        if (data.length > 0) {
          setArticle(data[0])
          
          // Fetch related articles
          const relatedRes = await fetch(`${supabaseUrl}/rest/v1/articles?category=eq.${data[0].category}&id=neq.${id}&limit=4`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          })
          const relatedData = await relatedRes.json()
          setRelated(relatedData || [])
        }
      } catch (err) {
        console.error(err)
      }
      setLoading(false)
    }
    fetchArticle()
  }, [id])
  
  if (loading) return <div className="loading">載入中...</div>
  if (!article) return <div className="loading">文章不存在</div>
  
  return (
    <div className="article-page">
      <header className="article-header">
        <Link to="/" className="back-link">← 返回首頁</Link>
      </header>
      <article className="article-content">
        <img src={getImage(article)} alt={article.title} className="article-hero-image" />
        <div className="article-text">
          <span className="article-badge">{categoryNames[article.category]}</span>
          <h1 className="article-title">{article.title}</h1>
          <div className="article-meta">
            <span className="author">{article.author}</span>
            <span className="date">{article.date}</span>
          </div>
          <div className="article-body" dangerouslySetInnerHTML={{ __html: article.content }}></div>
        </div>
      </article>
      
      {related.length > 0 && (
        <section className="related-section">
          <h3>相關文章</h3>
          <div className="news-grid">
            {related.map(a => (
              <Link to={`/article/${a.id}`} key={a.id} className="news-card">
                <div className="card-image">
                  <img src={getImage(a)} alt={a.title} />
                </div>
                <div className="card-content">
                  <h3 className="card-title">{a.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function AppWrapper() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/category/:category" element={<HomePage />} />
        <Route path="/page/:page" element={<HomePage />} />
        <Route path="/category/:category/page/:page" element={<HomePage />} />
        <Route path="/article/:id" element={<ArticlePage />} />
      </Routes>
    </BrowserRouter>
  )
}
