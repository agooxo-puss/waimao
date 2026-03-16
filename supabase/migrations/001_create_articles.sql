-- Create articles table
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  category TEXT DEFAULT 'world',
  author TEXT DEFAULT '歪貓編輯',
  date TEXT DEFAULT TO_CHAR(NOW(), 'YYYY年MM月DD日'),
  image TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO articles (title, excerpt, content, category, author, date, image) VALUES
('全球氣候峰會達成歷史性協議', '來自190多個國家的代表經過兩週艱苦談判，終於在巴黎氣候峰會上達成共識。', '<p>巴黎訊 - 為期兩週的全球氣候峰會於今日落下帷幕。</p>', 'world', '王明', '2026年3月15日', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=500&fit=crop'),
('蘋果發布全新AI助理', '蘋果公司推出了革命性的AI助理「Apple Intelligence」。', '<p>加州庫比蒂諾訊 - 蘋果公司推出了全新AI助理。</p>', 'tech', '李華', '2026年3月14日', 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=500&fit=crop'),
('阿根廷奪得世界盃冠軍', '阿根廷通過點球大戰戰勝法國，第三次捧起大力神杯。', '<p>多哈訊 - 2026年世界盃決賽今日舉行。</p>', 'sports', '張偉', '2026年3月13日', 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=500&fit=crop'),
('故宮博物院推出數位展覽', '故宮博物院推出全新數位展覽體驗，結合AR/VR技術。', '<p>北京訊 - 故宮博物院推出數位展覽。</p>', 'culture', '陳芳', '2026年3月12日', 'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=800&h=500&fit=crop'),
('比特幣突破10萬美元', '比特幣價格今日首次突破10萬美元大關。', '<p>紐約訊 - 比特幣創歷史新高。</p>', 'business', '劉強', '2026年3月11日', 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=500&fit=crop'),
('SpaceX發射火星飛船', 'SpaceX成功發射前往火星的殖民飛船。', '<p>佛羅里達州訊 - 人類首次載人火星任務。</p>', 'tech', '楊洋', '2026年3月10日', 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&h=500&fit=crop');

-- Enable RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public articles are viewable by everyone" 
  ON articles FOR SELECT 
  USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Users can insert articles" 
  ON articles FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update articles" 
  ON articles FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete articles" 
  ON articles FOR DELETE 
  USING (true);
