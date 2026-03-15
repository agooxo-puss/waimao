import { useState } from 'react'
import './App.css'

const articles = [
  {
    id: 1,
    title: "全球氣候峰會達成歷史性協議 各國承諾減排目標",
    excerpt: "來自190多個國家的代表經過兩週艱苦談判，終於在巴黎氣候峰會上達成共識，承諾在本世紀中葉實現碳中和目標。",
    category: "world",
    author: "王明",
    date: "2026年3月15日",
    image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=500&fit=crop",
    content: `<p>巴黎訊 - 為期兩週的全球氣候峰會於今日落下帷幕，來自190多個國家的代表經過艱苦談判，終於達成歷史性協議。</p><p>根據協議，各國承諾在2030年前將溫室氣體排放量減少50%，並在2050年前實現碳中和目標。這是迄今為止最具雄心的減排承諾。</p><p>聯合國秘書長在閉幕式上表示：「這是人類歷史上的轉折點。我們終於團結起來，共同應對氣候變化這一生存威脅。」</p>`
  },
  {
    id: 2,
    title: "蘋果發布全新AI助理 顛覆人機互動方式",
    excerpt: "蘋果公司在今日凌晨的發布會上推出了革命性的AI助理「Apple Intelligence」，宣稱將徹底改變用戶與設備的互動方式。",
    category: "tech",
    author: "李華",
    date: "2026年3月14日",
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=500&fit=crop",
    content: `<p>加州庫比蒂諾訊 - 蘋果公司在今日凌晨的特別發布會上正式推出了代號為「Apple Intelligence」的全新AI助理。</p><p>這款AI助理深度整合了iOS系統，可以理解用戶意圖、預測需求，並提供個性化的協助。</p>`
  },
  {
    id: 3,
    title: "阿根廷奪得世界盃冠軍 梅西終圓夢",
    excerpt: "在今日舉行的世界盃決賽中，阿根廷通過點球大戰戰勝法國，第三次捧起大力神杯。梅西在比賽中展現出球王風範。",
    category: "sports",
    author: "張偉",
    date: "2026年3月13日",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=500&fit=crop",
    content: `<p>多哈訊 - 2026年世界盃決賽今日在盧賽爾體育場舉行，阿根廷對陣法國。</p><p>經過90分鐘激戰，雙方戰成2:2平手。加時賽中，梅西打入關鍵進球，將比分改寫為3:2。</p>`
  },
  {
    id: 4,
    title: "故宮博物院推出數位展覽 讓文物活起來",
    excerpt: "故宮博物院今日宣布推出全新數位展覽體驗，結合AR/VR技術，讓觀眾能夠近距離欣賞館藏文物，並與之互動。",
    category: "culture",
    author: "陳芳",
    date: "2026年3月12日",
    image: "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=800&h=500&fit=crop",
    content: `<p>北京訊 - 故宮博物院今日舉辦發布會，宣布推出「數位故宮」計畫的全新展覽體驗。</p><p>這次數位展覽結合了增強現實（AR）和虛擬現實（VR）技術。</p>`
  },
  {
    id: 5,
    title: "比特幣突破10萬美元大關 加密貨幣市場狂歡",
    excerpt: "比特幣價格今日首次突破10萬美元大關，創下歷史新高。加密貨幣市場迎來新一輪投資熱潮。",
    category: "business",
    author: "劉強",
    date: "2026年3月11日",
    image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=500&fit=crop",
    content: `<p>紐約訊 - 比特幣價格今日在亞洲交易時段首次突破10萬美元大關，創下歷史新高。</p><p>這一里程碑標誌著加密貨幣在主流金融市場中的地位進一步鞏固。</p>`
  },
  {
    id: 6,
    title: "SpaceX成功發射火星殖民飛船 人類邁向太空時代",
    excerpt: "SpaceX今日成功發射了前往火星的殖民飛船，這是人類歷史上首次載人火星任務的實踐。",
    category: "tech",
    author: "楊洋",
    date: "2026年3月10日",
    image: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&h=500&fit=crop",
    content: `<p>佛羅里達州訊 - SpaceX今日在肯尼迪航天中心成功發射了「星際飛船」火星殖民飛船。</p><p>這艘載人飛船將攜帶12名宇航員前往火星，進行為期6個月的太空旅行。</p>`
  }
]

const categoryNames = {
  world: "國際",
  tech: "科技",
  sports: "體育",
  culture: "文化",
  business: "商業"
}

function App() {
  const [category, setCategory] = useState("all")
  const [selectedArticle, setSelectedArticle] = useState(null)

  const filteredArticles = category === "all" 
    ? articles 
    : articles.filter(a => a.category === category)

  return (
    <>
      <header>
        <div className="header-inner">
          <a href="#" className="logo">歪貓娛樂</a>
          <nav>
            <a href="#" className="active">首頁</a>
            <a href="#">熱門</a>
            <a href="#">科技</a>
            <a href="#">運動</a>
            <a href="#">娛樂</a>
          </nav>
          <button className="search-btn">搜尋</button>
        </div>
      </header>

      <main>
        <section className="hero" onClick={() => setSelectedArticle(articles[0])}>
          <img src={articles[0].image} alt="Featured" className="hero-image" />
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
              className={`category-tab ${category === "all" ? "active" : ""}`}
              onClick={() => setCategory("all")}
            >
              全部
            </button>
            <button 
              className={`category-tab ${category === "world" ? "active" : ""}`}
              onClick={() => setCategory("world")}
            >
              國際
            </button>
            <button 
              className={`category-tab ${category === "tech" ? "active" : ""}`}
              onClick={() => setCategory("tech")}
            >
              科技
            </button>
            <button 
              className={`category-tab ${category === "sports" ? "active" : ""}`}
              onClick={() => setCategory("sports")}
            >
              體育
            </button>
            <button 
              className={`category-tab ${category === "culture" ? "active" : ""}`}
              onClick={() => setCategory("culture")}
            >
              文化
            </button>
            <button 
              className={`category-tab ${category === "business" ? "active" : ""}`}
              onClick={() => setCategory("business")}
            >
              商業
            </button>
          </div>
        </section>

        <section className="news-section container">
          <h2 className="section-title">最新消息</h2>
          <div className="news-grid">
            {filteredArticles.map((article) => (
              <article 
                key={article.id} 
                className="news-card"
                onClick={() => setSelectedArticle(article)}
              >
                <div className="card-image">
                  <img src={article.image} alt={article.title} loading="lazy" />
                  <span className="card-badge">{categoryNames[article.category]}</span>
                </div>
                <div className="card-content">
                  <h3 className="card-title">{article.title}</h3>
                  <p className="card-excerpt">{article.excerpt}</p>
                  <div className="card-meta">
                    <div className="avatar">{article.author[0]}</div>
                    <span className="author">{article.author}</span>
                    <span>·</span>
                    <span>{article.date}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
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
          <div className="modal-overlay" onClick={() => setSelectedArticle(null)}></div>
          <div className="modal">
            <button className="modal-close" onClick={() => setSelectedArticle(null)}>×</button>
            <img src={selectedArticle.image} alt="" className="modal-image" />
            <div className="modal-content">
              <h2 className="modal-title">{selectedArticle.title}</h2>
              <div className="modal-meta">
                <div className="avatar">{selectedArticle.author[0]}</div>
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
    </>
  )
}

export default App
