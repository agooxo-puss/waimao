const supabaseKey = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_'
const imgbbKey = '0adf63c6f03335970b97ae80bd4e2078'

async function uploadToImgBB(imageUrl) {
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
      method: 'POST',
      body: new URLSearchParams({ image: imageUrl })
    })
    const data = await res.json()
    return data.success ? data.data.url : null
  } catch (e) {
    return null
  }
}

async function fetchMacauDailyNews() {
  const res = await fetch('https://appimg.modaily.cn/amucsite/web/index.html#/home')
  const html = await res.text()
  
  const news = []
  const regex = /#\/detail\/(\d+)/g
  let match
  const ids = new Set()
  while ((match = regex.exec(html)) !== null) {
    ids.add(match[1])
  }
  
  for (const id of Array.from(ids).slice(0, 10)) {
    try {
      const detailRes = await fetch(`https://appimg.modaily.cn/amucsite/web/index.html#/detail/${id}`)
      const detailHtml = await detailRes.text()
      
      const titleMatch = detailHtml.match(/<h1[^>]*>([^<]+)<\/h1>/)
      const imgMatch = detailHtml.match(/img\[src\*="pic"\][^>]*src="([^"]+)"/)
      
      if (titleMatch) {
        let imageUrl = imgMatch ? imgMatch[1] : null
        
        if (imageUrl) {
          const uploaded = await uploadToImgBB(imageUrl)
          if (uploaded) imageUrl = uploaded
          else imageUrl = null
        }
        
        news.push({
          title: titleMatch[1].trim(),
          image: imageUrl,
          id: id
        })
      }
    } catch (e) {
      console.log('Error fetching', id, e.message)
    }
  }
  
  return news
}

async function syncToSupabase() {
  console.log('Syncing Macau Daily news...')
  const news = await fetchMacauDailyNews()
  console.log(`Found ${news.length} news`)
  
  for (const item of news) {
    const res = await fetch('https://sjokgfqpyuzrhuvrnvcz.supabase.co/rest/v1/articles?select=id&title=eq.' + encodeURIComponent(item.title), {
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey
      }
    })
    const existing = await res.json()
    
    if (existing.length === 0) {
      await fetch('https://sjokgfqpyuzrhuvrnvcz.supabase.co/rest/v1/articles', {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          title: item.title,
          excerpt: item.title,
          content: `<p>${item.title}</p>`,
          category: 'macaodaily',
          author: '澳門日報',
          date: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }),
          image: item.image
        })
      })
      console.log('Added:', item.title)
    }
  }
}

syncToSupabase()
