const supabaseKey = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_'

const newsList = [
  { id: '9971673', title: '日本今起釋八千萬桶石油儲備', img: 'https://appimg.modaily.cn/app/pic/2026-03/16/9971673_8ca6ce22-2dcf-4984-af04-ac057aaec0a1.jpg', content: '日本政府定於今日起釋放石油儲備，以緩解因中東局勢緊張引發的油價上升。這次釋放量合計約8,000萬桶，相當於日本45天所需的石油供應。' },
  { id: '9971689', title: '秘魯總統候選人競選途中車禍亡', img: 'https://appimg.modaily.cn/app/pic/2026-03/16/9971689_5bd962cd-56d5-4a1d-a3e7-dc3c54260926.jpg', content: '秘魯2026年總統大選候選人貝塞拉周日從阿亞庫喬參加競選活動途中遭遇交通事故身亡。' },
]

export default async function handler(req, res) {
  let added = 0
  
  for (const item of newsList) {
    const checkRes = await fetch(`https://sjokgfqpyuzrhuvrnvcz.supabase.co/rest/v1/articles?select=id&title=eq.${encodeURIComponent(item.title)}`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })
    const existing = await checkRes.json()

    if (existing.length === 0) {
      await fetch('https://sjokgfqpyuzrhuvrnvcz.supabase.co/rest/v1/articles', {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          title: item.title,
          excerpt: item.content,
          content: `<p>${item.content}</p>`,
          category: 'macaodaily',
          author: '澳門日報',
          date: '2026年3月16日',
          image: item.img
        })
      })
      added++
    }
  }

  res.json({ success: true, added })
}
