import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

function App() {
  const [activeTab, setActiveTab] = useState('首页')
  const [posts, setPosts] = useState([])
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [selectedPost, setSelectedPost] = useState(null)
  const [editingPost, setEditingPost] = useState(null)
  const [newPostMode, setNewPostMode] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [editedDate, setEditedDate] = useState('')
  const [editedTags, setEditedTags] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [remember, setRemember] = useState(false)

  const [postComments, setPostComments] = useState([])
  const [newPostComment, setNewPostComment] = useState('')
  const [onlineCount, setOnlineCount] = useState(1)
  const [filterTag, setFilterTag] = useState('全部')

  // 站长回复状态
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // 留言板：访客互相回复状态
  const [visitorReplyTo, setVisitorReplyTo] = useState(null)
  const [visitorReplyText, setVisitorReplyText] = useState('')

  // 讨论区：访客互相回复状态
  const [postReplyTo, setPostReplyTo] = useState(null)
  const [postReplyText, setPostReplyText] = useState('')

  // 音乐播放器
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playerSource, setPlayerSource] = useState('netease') // 'netease' | 'spotify'


  const tabs = ['首页', '个人简介', '我的日志', '留言板']

  const allTags = useMemo(() => {
    const tags = posts.flatMap(p => Array.isArray(p.tags) ? p.tags : [])
    return ['全部', ...new Set(tags)]
  }, [posts])

  const filteredPosts = useMemo(() => {
    return filterTag === '全部' ? posts : posts.filter(p => Array.isArray(p.tags) && p.tags.includes(filterTag))
  }, [posts, filterTag])

  // 把扁平留言整理为树形（顶级留言 + 子回复）
  const commentTree = useMemo(() => {
    const top = comments.filter(c => !c.parent_id)
    return top.map(c => ({
      ...c,
      replies: comments
        .filter(r => r.parent_id === c.id)
        .sort((a, b) => new Date(a.time) - new Date(b.time))
    }))
  }, [comments])

  // 讨论区也做树形整理
  const postCommentTree = useMemo(() => {
    const top = postComments.filter(c => !c.parent_id)
    return top.map(c => ({
      ...c,
      replies: postComments
        .filter(r => r.parent_id === c.id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }))
  }, [postComments])

  const handleTabChange = (tab) => {
    setActiveTab(tab); setSelectedPost(null); setEditingPost(null)
    setNewPostMode(false); setFilterTag('全部'); setVisitorReplyTo(null); setPostReplyTo(null)
  }

  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: { presence: { key: 'user-' + Math.random().toString(36).substr(2, 9) } },
    })
    channel
      .on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(channel.presenceState()).length))
      .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() }) })
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase.from('logs').select('*').order('date', { ascending: false })
      if (error) console.error(error); else setPosts(data || [])
    }
    fetchPosts()
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('bbs_user')
    if (saved) {
      const { name: sName, email: sEmail, remember: sRemember } = JSON.parse(saved)
      setName(sName || ''); setEmail(sEmail || ''); setRemember(sRemember || false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== '留言板') return
    const fetchComments = async () => {
      setLoading(true)
      const { data, error } = await supabase.from('message').select('*').order('time', { ascending: false })
      if (error) console.error(error); else setComments(data || [])
      setLoading(false)
    }
    fetchComments()
    const channel = supabase.channel('message-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message' }, (payload) => {
        setComments(prev => prev.some(c => c.id === payload.new.id) ? prev : [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message' }, (payload) => {
        setComments(prev => prev.map(c => c.id === payload.new.id ? payload.new : c))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message' }, (payload) => {
        setComments(prev => prev.filter(c => c.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeTab])

  useEffect(() => {
    if (!selectedPost?.id) { setPostComments([]); return }
    const fetchPostComments = async () => {
      const { data, error } = await supabase.from('post_comments').select('*')
        .eq('log_id', selectedPost.id).order('created_at', { ascending: true })
      if (!error) setPostComments(data || [])
    }
    fetchPostComments()
  }, [selectedPost])

  // 发表顶级留言
  const handleCommentSubmit = async () => {
    if (!name.trim() || !email.trim() || !newComment.trim()) { alert('昵称、电子邮件和留言不能为空'); return }
    if (!EMAIL_REGEX.test(email.trim())) { alert('请输入有效的电子邮件格式'); return }
    setLoading(true)
    const { data, error } = await supabase.from('message')
      .insert([{ name: name.trim(), email: email.trim(), content: newComment.trim() }]).select()
    if (error) { alert(`发表失败：${error.message}`) }
    else {
      if (data?.[0]) setComments(prev => prev.some(c => c.id === data[0].id) ? prev : [data[0], ...prev])
      if (remember) localStorage.setItem('bbs_user', JSON.stringify({ name: name.trim(), email: email.trim(), remember: true }))
      else localStorage.removeItem('bbs_user')
      setNewComment('')
    }
    setLoading(false)
  }

  // 访客回复某条留言
  const handleVisitorReply = async () => {
    if (!name.trim() || !email.trim() || !visitorReplyText.trim()) { alert('昵称、邮箱和回复内容不能为空'); return }
    if (!EMAIL_REGEX.test(email.trim())) { alert('请输入有效的邮箱格式'); return }
    const { data, error } = await supabase.from('message')
      .insert([{ name: name.trim(), email: email.trim(), content: visitorReplyText.trim(), parent_id: visitorReplyTo.id }]).select()
    if (error) { alert(`回复失败：${error.message}`) }
    else {
      if (data?.[0]) setComments(prev => prev.some(c => c.id === data[0].id) ? prev : [data[0], ...prev])
      if (remember) localStorage.setItem('bbs_user', JSON.stringify({ name: name.trim(), email: email.trim(), remember: true }))
      setVisitorReplyTo(null); setVisitorReplyText('')
    }
  }

  // 帖子评论
  const handlePostCommentSubmit = async () => {
    if (!name.trim() || !email.trim() || !newPostComment.trim()) { alert('昵称、电子邮件和留言内容不能为空'); return }
    if (!EMAIL_REGEX.test(email.trim())) { alert('请输入有效的电子邮件格式'); return }
    const { data, error } = await supabase.from('post_comments')
      .insert([{ log_id: selectedPost.id, name: name.trim(), email: email.trim(), content: newPostComment.trim() }]).select()
    if (!error && data) {
      setPostComments(prev => [...prev, data[0]]); setNewPostComment('')
      if (remember) localStorage.setItem('bbs_user', JSON.stringify({ name, email, remember: true }))
    } else { alert('发布失败，请检查数据库设置') }
  }

  // 讨论区：访客回复某条评论（parent_id）
  const handlePostVisitorReply = async () => {
    if (!name.trim() || !email.trim() || !postReplyText.trim()) { alert('昵称、邮箱和回复内容不能为空'); return }
    if (!EMAIL_REGEX.test(email.trim())) { alert('请输入有效的邮箱格式'); return }
    const { data, error } = await supabase.from('post_comments')
      .insert([{ log_id: selectedPost.id, name: name.trim(), email: email.trim(), content: postReplyText.trim(), parent_id: postReplyTo.id }]).select()
    if (error) { alert(`回复失败：${error.message}`) }
    else {
      if (data?.[0]) setPostComments(prev => [...prev, data[0]])
      if (remember) localStorage.setItem('bbs_user', JSON.stringify({ name: name.trim(), email: email.trim(), remember: true }))
      setPostReplyTo(null); setPostReplyText('')
    }
  }

  // 讨论区：管理员删除顶级评论（连同子回复）
  const handleDeletePostComment = async (comment) => {
    const childIds = postComments.filter(c => c.parent_id === comment.id).map(c => c.id)
    const msg = childIds.length > 0
      ? `确认删除「${comment.name}」的评论及其 ${childIds.length} 条回复？`
      : `确认删除「${comment.name}」的评论？`
    if (!window.confirm(msg)) return
    if (childIds.length > 0) await supabase.from('post_comments').delete().in('id', childIds)
    const { error } = await supabase.from('post_comments').delete().eq('id', comment.id)
    if (error) alert(`删除失败：${error.message}`)
    else setPostComments(prev => prev.filter(c => c.id !== comment.id && !childIds.includes(c.id)))
  }

  // 讨论区：管理员删除子回复
  const handleDeletePostReply = async (reply) => {
    if (!window.confirm(`确认删除「${reply.name}」的回复？`)) return
    const { error } = await supabase.from('post_comments').delete().eq('id', reply.id)
    if (error) alert(`删除失败：${error.message}`)
    else setPostComments(prev => prev.filter(c => c.id !== reply.id))
  }

  // 站长回复（发邮件）
  const handleAdminReply = async (comment) => {
    if (!replyText.trim()) { alert('回复内容不能为空'); return }
    setSendingReply(true)
    try {
      const { error: updateError } = await supabase.from('message').update({ reply: replyText.trim() }).eq('id', comment.id)
      if (updateError) throw updateError
      const { error: fnError } = await supabase.functions.invoke('send-reply-email', {
        body: { to: comment.email, name: comment.name, originalMessage: comment.content, reply: replyText.trim() }
      })
      if (fnError) alert(`回复已保存，但邮件发送失败：${fnError.message}`)
      else alert(`回复已发送，并已邮件通知 ${comment.name}（${comment.email}）`)
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, reply: replyText.trim() } : c))
      setReplyingTo(null); setReplyText('')
    } catch (err) { alert(`操作失败：${err.message}`) }
    finally { setSendingReply(false) }
  }

  // 删除顶级留言（连同子回复）
  const handleDeleteComment = async (comment) => {
    const childIds = comments.filter(c => c.parent_id === comment.id).map(c => c.id)
    const msg = childIds.length > 0
      ? `确认删除「${comment.name}」的留言及其 ${childIds.length} 条回复？`
      : `确认删除「${comment.name}」的留言？`
    if (!window.confirm(msg)) return
    if (childIds.length > 0) await supabase.from('message').delete().in('id', childIds)
    const { error } = await supabase.from('message').delete().eq('id', comment.id)
    if (error) alert(`删除失败：${error.message}`)
    else setComments(prev => prev.filter(c => c.id !== comment.id && !childIds.includes(c.id)))
  }

  // 删除子回复
  const handleDeleteReply = async (reply) => {
    if (!window.confirm(`确认删除「${reply.name}」的回复？`)) return
    const { error } = await supabase.from('message').delete().eq('id', reply.id)
    if (error) alert(`删除失败：${error.message}`)
    else setComments(prev => prev.filter(c => c.id !== reply.id))
  }

  const handlePostClick = async (post) => {
    setSelectedPost(post)
    const { error } = await supabase.rpc('increment_views', { log_id: post.id })
    if (!error) setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: p.views + 1 } : p))
  }

  const closePost = () => setSelectedPost(null)

  const startEdit = (post) => {
    setEditingPost(post); setNewPostMode(false)
    setEditedTitle(post.title); setEditedContent(post.content)
    setEditedDate(post.date); setEditedTags(post.tags ? post.tags.join(', ') : '')
  }

  const startNewPost = () => {
    setNewPostMode(true); setEditingPost(null); setEditedTitle(''); setEditedContent('')
    setEditedDate(new Date().toISOString().slice(0, 10)); setEditedTags('')
  }

  const handleDeletePost = async (id) => {
    if (!window.confirm('真的要删除这篇日志吗？此操作不可逆哦！')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('logs').delete().eq('id', id)
      if (error) throw error
      setPosts(prev => prev.filter(p => p.id !== id)); setSelectedPost(null); setActiveTab('我的日志')
    } catch (err) { alert(`删除失败：${err.message}`) }
    finally { setLoading(false) }
  }

  const saveEdit = async () => {
    if (!editedTitle.trim() || !editedContent.trim() || !editedDate.trim()) { alert('标题、内容和日期不能为空！'); return }
    setLoading(true)
    const newTags = editedTags.split(',').map(t => t.trim()).filter(t => t)
    try {
      if (newPostMode) {
        const { data, error } = await supabase.from('logs')
          .insert([{ title: editedTitle.trim(), content: editedContent.trim(), date: editedDate, tags: newTags, views: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]).select()
        if (error) throw error
        if (data) { setPosts(prev => [data[0], ...prev]); alert('日志发布成功！') }
      } else {
        const { data, error } = await supabase.from('logs')
          .update({ title: editedTitle.trim(), content: editedContent.trim(), date: editedDate, tags: newTags, updated_at: new Date().toISOString() })
          .eq('id', editingPost.id).select()
        if (error) throw error
        if (data) {
          setPosts(prev => prev.map(p => p.id === data[0].id ? data[0] : p))
          if (selectedPost?.id === data[0].id) setSelectedPost(data[0])
          alert('修改已保存！')
        }
      }
      setNewPostMode(false); setEditingPost(null)
    } catch (err) { alert(`操作失败：${err.message}`) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (localStorage.getItem('bbs_admin') === 'true') setIsAdmin(true) }, [])

  // ── 辅助函数 ────────────────────────────────────────
  // 建议05: 阅读时长估算（300字/分钟）
  const readingTime = (content) => {
    const chars = (content || '').replace(/\s/g, '').length
    const mins = Math.max(1, Math.round(chars / 300))
    return `约 ${mins} 分钟`
  }

  // 建议04: 纯文本摘要（去掉 Markdown 标记）
  const getExcerpt = (content, len = 80) => {
    const plain = (content || '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*|__|\*|_|~~|`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim()
    return plain.length > len ? plain.slice(0, len) + '...' : plain
  }

  // 建议06: 热帖阈值
  const HOT_THRESHOLD = 100

  // 访客回复表单（内联组件）
  const VisitorReplyForm = () => (
    <div className="mt-3 bg-[#f0f4ff] border border-[#000080] p-4 space-y-3">
      <div className="text-xs font-bold text-[#000080]">↩ 回复 {visitorReplyTo?.name}：</div>
      <textarea value={visitorReplyText} onChange={e => setVisitorReplyText(e.target.value)}
        placeholder="支持 Markdown..."
        className="w-full h-20 p-2 border border-black text-sm bg-white resize-none focus:outline-none focus:border-[#000080]" autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold mb-1">昵称 *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full p-1.5 border border-black bg-white text-xs focus:outline-none" placeholder="必填" />
        </div>
        <div>
          <label className="block text-[10px] font-bold mb-1">邮箱 *（不公开）</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className={`w-full p-1.5 border bg-white text-xs focus:outline-none ${email && !EMAIL_REGEX.test(email) ? 'border-red-500' : 'border-black'}`}
            placeholder="example@email.com" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleVisitorReply}
          disabled={!name.trim() || !email.trim() || !visitorReplyText.trim() || (!!email && !EMAIL_REGEX.test(email))}
          className="px-5 py-1.5 bg-[#000080] text-white text-xs font-bold border border-black hover:bg-[#0000c0] disabled:opacity-40">
          发表回复
        </button>
        <button onClick={() => { setVisitorReplyTo(null); setVisitorReplyText('') }}
          className="px-5 py-1.5 bg-gray-400 text-white text-xs font-bold border border-black hover:bg-gray-500">
          取消
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#c0c0c0] font-bbs text-black">

      <header className="forum-header py-6">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-widest">Bareerah 的小屋</h1>
            <p className="text-sm mt-1 opacity-90">海椰的个人网站</p>
          </div>
          <div className="text-right text-xs opacity-80">欢迎光临<br />当前在线：<span className="font-bold text-yellow-300">{onlineCount}</span></div>
        </div>
      </header>

      <nav className="forum-nav py-3 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab} onClick={() => handleTabChange(tab)}
              className={`px-8 py-2 text-sm border-2 transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white border-b-0 border-[#000080] text-black font-bold' : 'bg-[#c0c0c0] border-[#000] hover:bg-[#dfdfdf]'}`}>
              {tab}
            </button>
          ))}
          {isAdmin && <span className="ml-auto text-xs text-yellow-200 self-center px-2 border border-yellow-300 opacity-75">🔑 管理员</span>}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {(newPostMode || editingPost) && (
          <div className="mb-8 p-6 bg-[#fffbe6] border-4 border-[#808080] shadow-[4px_4px_0_#000]">
            <h3 className="text-lg font-bold mb-4 border-b-2 border-black pb-2 flex items-center gap-2">
              <span className="bg-[#000080] text-white px-2 py-0.5 text-sm">ADMIN</span>
              {newPostMode ? '新建日志' : '编辑日志'}
            </h3>
            <input value={editedTitle} onChange={e => setEditedTitle(e.target.value)} placeholder="标题" className="w-full p-2 border-2 border-black mb-4 focus:outline-none" />
            <input type="date" value={editedDate} onChange={e => setEditedDate(e.target.value)} className="w-full p-2 border-2 border-black mb-4 focus:outline-none" />
            <textarea value={editedContent} onChange={e => setEditedContent(e.target.value)} placeholder="内容 (支持 Markdown)" className="w-full h-64 p-2 border-2 border-black mb-4 focus:outline-none" />
            <input value={editedTags} onChange={e => setEditedTags(e.target.value)} placeholder="标签 (逗号分隔)" className="w-full p-2 border-2 border-black mb-4 focus:outline-none" />
            <div className="flex gap-4">
              <button onClick={saveEdit} disabled={loading} className="px-6 py-2 bg-[#000080] text-white font-bold border-2 border-black disabled:opacity-50">{loading ? '保存中...' : '保存'}</button>
              <button onClick={() => { setNewPostMode(false); setEditingPost(null) }} className="px-6 py-2 bg-gray-500 text-white font-bold border-2 border-black">取消</button>
              {!newPostMode && <button onClick={() => handleDeletePost(editingPost.id)} className="px-6 py-2 bg-red-600 text-white font-bold border-2 border-black ml-auto">删除此帖</button>}
            </div>
          </div>
        )}

        <div className="forum-main p-8 min-h-[70vh]">

          {activeTab === '首页' && (
            <div>
              {/* 欢迎区 */}
              <div className="text-center py-10">
                <div className="mx-auto w-24 h-24 bg-[#000080] text-white rounded-full flex items-center justify-center text-5xl mb-6 shadow-[4px_4px_0_#000]">🐱</div>
                <h2 className="text-3xl mb-4">欢迎来到我的个人网站</h2>
                <p className="text-lg max-w-md mx-auto">这里记录我对学习、生活的一些思考。<br />欢迎交流～</p>
              </div>

              {/* 建议01: 状态公告栏 */}
              <div className="border-4 border-[#808080] shadow-[3px_3px_0_#000] mb-6 overflow-hidden">
                <div className="bg-[#000080] text-white px-4 py-2 text-xs font-bold flex items-center justify-between">
                  <span>📌 公告栏 / Status Board</span>
                  <span className="opacity-60">{new Date().toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="bg-[#f8f4e8] grid grid-cols-2 md:grid-cols-4 gap-0 divide-x-2 divide-[#808080] text-sm">
                  {[
                    { label: '最近在做', value: '学习前端、AI 和 Web3 协议层，参加黑客松' },
                    { label: '当前在读', value: '「在轮下」— 黑塞' },
                    { label: '心情', value: '忙碌但充实 🎵' },
                    { label: '本站数据', value: `${posts.length} 篇日志 · ${comments.length} 条留言` },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-4 py-3">
                      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
                      <div className="text-xs font-bold leading-snug">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-gray-500 text-center pb-4">
                最新更新：{posts[0]?.title} • {posts[0]?.date}
              </div>
            </div>
          )}

          {activeTab === '个人简介' && (
            <div>
              <h2 className="text-2xl border-b-4 border-black pb-2 mb-6">关于我</h2>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/3">
                  <div className="bg-[#000080] text-white p-6 text-center shadow-[4px_4px_0_#000]">
                    <div className="w-32 h-32 mx-auto bg-white rounded-full overflow-hidden border-4 border-white">
                      <img src="https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/person/Avatar.jpg" alt="头像" className="w-full h-full object-cover" />
                    </div>
                    <p className="mt-4 font-bold">海椰<br />Bareerah</p>
                    <p className="text-xs opacity-75">深圳 / 香港</p>
                  </div>
                </div>
                <div className="md:w-2/3 space-y-6 text-sm">
                  <p>本科西安某211，现港硕在读。</p>
                  <p>目前对以太坊生态和 AI 充满热情，正在积极学习 Solidity、Agent 相关知识。</p>
                  <div>
                    <strong className="block mb-2">技术栈：</strong>
                    {/* 建议02: 技术栈徽章 */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: 'Python', color: 'bg-[#3776AB] text-white' },
                        { name: 'React', color: 'bg-[#61DAFB] text-[#1a1a2e]' },
                        { name: 'Solidity', color: 'bg-[#363636] text-white' },
                        { name: 'Web3', color: 'bg-[#F16822] text-white' },
                        { name: 'AI Agent', color: 'bg-[#000080] text-white' },
                        { name: 'Vite', color: 'bg-[#646CFF] text-white' },
                        { name: 'Supabase', color: 'bg-[#3ECF8E] text-[#1a1a1a]' },
                      ].map(({ name, color }) => (
                        <span key={name} className={`${color} px-3 py-1 text-xs font-bold border-2 border-black shadow-[2px_2px_0_#000]`}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <strong>联系方式：</strong><br />
                    <a href="https://x.com/EASTERN_Z_CHILD" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-red-600 underline">X</a>
                    {' | '}
                    <a href="https://github.com/BareerahBenjamin" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-red-600 underline">GitHub</a><br />
                    <a href="bareerahmoooo@gmail.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-red-600 underline">Email</a><br /> 
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === '我的日志' && (
            selectedPost ? (
              <div>
                <button onClick={closePost} className="bbs-link mb-6 text-sm hover:underline">← 返回日志列表</button>
                <div className="post p-8 bg-white border-2 border-black shadow-[4px_4px_0_#000]">
                  <div className="text-2xl font-bold border-b-2 border-black pb-4">{selectedPost.title}</div>
                  <div className="text-xs text-gray-600 mt-2 mb-8">发布日期：{selectedPost.date}</div>
                  <div className="prose prose-slate lg:prose-lg max-w-none my-8 prose-headings:font-bold prose-headings:text-black prose-p:text-gray-800 prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 prose-blockquote:border-l-4 prose-blockquote:border-gray-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}
                      components={{
                        img: ({ node, ...props }) => <img style={{ maxWidth: '100%', height: 'auto' }} className="my-4 border-2 border-black" {...props} />,
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '')
                          const langName = match ? match[1] : ''
                          return !inline ? (
                            <div className="code-block-wrapper">
                              {langName && <div className="code-lang-tag">{langName.toUpperCase()}</div>}
                              <pre className={className}><code {...props}>{children}</code></pre>
                            </div>
                          ) : <code className={className} {...props}>{children}</code>
                        }
                      }}>
                      {String(selectedPost?.content || '')}
                    </ReactMarkdown>
                  </div>

                  <div className="mt-12 border-t-2 border-black pt-8">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <span className="bg-[#000080] text-white px-2 py-0.5 text-sm italic">RE:</span> 讨论区
                    </h3>
                    <div className="space-y-4 mb-8">
                      {postCommentTree.length === 0 ? (
                        <p className="text-gray-500 italic text-sm">暂无回帖，欢迎留言！</p>
                      ) : (
                        postCommentTree.map((c, index) => (
                          <div key={c.id} className="bg-[#f5f5f5] border border-black shadow-[2px_2px_0_#000]">
                            {/* 评论头部 */}
                            <div className="bg-[#000080] text-white px-3 py-1.5 flex justify-between text-[10px]">
                              <span className="font-bold">#{index + 1} 访客: {c.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="opacity-75">{new Date(c.created_at).toLocaleString('zh-CN')}</span>
                                {isAdmin && (
                                  <button onClick={() => handleDeletePostComment(c)}
                                    className="text-red-300 hover:text-white border border-red-300 hover:border-white px-1.5 py-0.5 transition-colors">
                                    🗑 删除
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* 评论正文 */}
                            <div className="p-4">
                              <div className="text-sm prose-sm">
                                <ReactMarkdown>{String(c.content || '')}</ReactMarkdown>
                              </div>
                              {/* 子回复列表 */}
                              {c.replies && c.replies.length > 0 && (
                                <div className="mt-3 space-y-2 pl-4 border-l-2 border-[#c0c0c0]">
                                  {c.replies.map(r => (
                                    <div key={r.id} className="bg-white border border-gray-300 p-3">
                                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1.5">
                                        <span className="font-bold text-[#000080]">↳ {r.name}</span>
                                        <div className="flex items-center gap-2">
                                          <span>{new Date(r.created_at).toLocaleString('zh-CN')}</span>
                                          {isAdmin && (
                                            <button onClick={() => handleDeletePostReply(r)}
                                              className="text-red-400 hover:text-red-600 transition-colors">🗑</button>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-sm prose-sm">
                                        <ReactMarkdown>{String(r.content || '')}</ReactMarkdown>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* 访客回复按钮 / 表单 */}
                              <div className="mt-3">
                                {postReplyTo?.id === c.id ? (
                                  <div className="bg-[#f0f4ff] border border-[#000080] p-4 space-y-3">
                                    <div className="text-xs font-bold text-[#000080]">↩ 回复 {c.name}：</div>
                                    <textarea value={postReplyText} onChange={e => setPostReplyText(e.target.value)}
                                      placeholder="支持 Markdown..."
                                      className="w-full h-20 p-2 border border-black text-sm bg-white resize-none focus:outline-none focus:border-[#000080]" autoFocus />
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-[10px] font-bold mb-1">昵称 *</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)}
                                          className="w-full p-1.5 border border-black bg-white text-xs focus:outline-none" placeholder="必填" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold mb-1">邮箱 *（不公开）</label>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                          className={`w-full p-1.5 border bg-white text-xs focus:outline-none ${email && !EMAIL_REGEX.test(email) ? 'border-red-500' : 'border-black'}`}
                                          placeholder="example@email.com" />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={handlePostVisitorReply}
                                        disabled={!name.trim() || !email.trim() || !postReplyText.trim() || (!!email && !EMAIL_REGEX.test(email))}
                                        className="px-5 py-1.5 bg-[#000080] text-white text-xs font-bold border border-black hover:bg-[#0000c0] disabled:opacity-40">
                                        发表回复
                                      </button>
                                      <button onClick={() => { setPostReplyTo(null); setPostReplyText('') }}
                                        className="px-5 py-1.5 bg-gray-400 text-white text-xs font-bold border border-black">
                                        取消
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => { setPostReplyTo(c); setPostReplyText('') }}
                                    className="text-xs text-[#000080] hover:underline flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                    ↩ 回复此评论
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="bg-[#dfdfdf] p-6 border-2 border-black shadow-[3px_3px_0_#000]">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold mb-1">您的留言：</label>
                          <textarea value={newPostComment} onChange={e => setNewPostComment(e.target.value)}
                            placeholder="支持 Markdown 语法..." className="w-full h-24 p-2 border border-black text-sm focus:outline-none bg-white resize-none" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold mb-1">昵称：</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border border-black bg-white text-sm focus:outline-none" placeholder="必填" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">电子邮件：</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                              className={`w-full p-2 border bg-white text-sm focus:outline-none ${email && !EMAIL_REGEX.test(email) ? 'border-red-500' : 'border-black'}`} placeholder="不公开" />
                            {email && !EMAIL_REGEX.test(email) && <p className="text-red-600 text-[10px] mt-0.5">邮箱格式不正确</p>}
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button onClick={handlePostCommentSubmit}
                            disabled={!name.trim() || !email.trim() || !newPostComment.trim() || (!!email && !EMAIL_REGEX.test(email))}
                            className="px-10 py-2 bg-white border-2 border-black text-xs font-bold hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_#000] disabled:opacity-40">
                            发表评论
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 pt-6 border-t text-xs text-gray-500">
                    最后编辑于 {new Date(selectedPost.updated_at).toLocaleString('zh-CN')} • 浏览量：{selectedPost.views}
                  </div>
                  {isAdmin && (
                    <button onClick={() => startEdit(selectedPost)} className="mt-4 px-6 py-2 bg-[#000080] text-white font-bold border-2 border-black hover:bg-[#0000c0]">编辑此日志</button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl border-b-4 border-black pb-2 mb-6">我的日志（Blog）</h2>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  {isAdmin && <button onClick={startNewPost} className="px-6 py-2 bg-[#000080] text-white font-bold border-2 border-black hover:bg-[#0000c0] shadow-[2px_2px_0_#000]">新建日志 +</button>}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold mr-1">分类:</span>
                    {allTags.map(tag => (
                      <button key={tag} onClick={() => setFilterTag(tag)}
                        className={`px-3 py-1 text-[10px] border-2 transition-all ${filterTag === tag ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-400 hover:border-black'}`}>
                        {tag === '全部' ? 'ALL' : `#${tag}`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-6">
                  {filteredPosts.map(post => {
                    const isHot = post.views >= HOT_THRESHOLD
                    return (
                      <div key={post.id} onClick={() => handlePostClick(post)}
                        className="post p-6 cursor-pointer bg-white border-2 border-black hover:bg-[#f0f0f0] transition-all group shadow-[3px_3px_0_#000] active:translate-x-0.5 active:translate-y-0.5">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-lg font-bold group-hover:underline text-[#000080]">{post.title}</div>
                              {/* 建议06: 热帖标记 */}
                              {isHot && (
                                <span className="bg-[#cc0000] text-white text-[9px] font-bold px-2 py-0.5 border border-[#800000] shadow-[1px_1px_0_#500]">
                                  🔥 热帖
                                </span>
                              )}
                            </div>
                            {/* 建议05: 阅读时长 */}
                            <div className="text-[10px] text-gray-500 mt-1">
                              {post.date} · 浏览 {post.views} · {readingTime(post.content)}
                            </div>
                            {/* 建议04: 摘要预览 */}
                            <div className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-2">
                              {getExcerpt(post.content)}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 items-end flex-shrink-0">
                            {Array.isArray(post.tags) ? post.tags.map(tag => (
                              <span key={tag} className={`px-2 py-0.5 text-[9px] border ${filterTag === tag ? 'bg-black text-white border-black' : 'bg-[#e8e8e8] text-gray-600 border-gray-400'}`}>#{tag}</span>
                            )) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          )}

          {/* ── 留言板 ── */}
          {activeTab === '留言板' && (
            <div className="max-w-2xl mx-auto">

              <div className="bg-[#000080] text-white px-6 py-3 flex items-center justify-between border-2 border-b-0 border-black shadow-[3px_0px_0_#000]">
                <h2 className="text-lg font-bold tracking-widest">📋 留言板 / Message Board</h2>
                <span className="text-xs opacity-75 border border-white/40 px-2 py-0.5">共 {commentTree.length} 楼</span>
              </div>

              <div className="bg-[#f8f4e8] border-4 border-[#808080] p-8 shadow-[3px_3px_0_#000] mb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold mb-2">✏️ 您的留言（支持 Markdown + HTML）</label>
                    <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                      placeholder="在这里畅所欲言..."
                      className="w-full h-40 p-4 border-2 border-black bg-white resize-y focus:outline-none focus:border-[#000080] text-base transition-colors" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-1">昵称 <span className="text-red-600 font-normal text-xs">* 必填</span></label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)}
                        className="w-full p-3 border-2 border-black bg-white focus:outline-none focus:border-[#000080] transition-colors" placeholder="请输入昵称" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-1">电子邮件 <span className="text-red-600 font-normal text-xs">* 必填，不公开</span></label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        className={`w-full p-3 border-2 bg-white focus:outline-none transition-colors ${email && !EMAIL_REGEX.test(email) ? 'border-red-500' : 'border-black focus:border-[#000080]'}`}
                        placeholder="example@email.com" />
                      {email && !EMAIL_REGEX.test(email) && <p className="text-red-600 text-xs mt-1">⚠ 请输入有效的邮箱格式</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="remember" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 border-2 border-black accent-black" />
                    <label htmlFor="remember" className="text-sm cursor-pointer select-none">记住我的信息</label>
                  </div>
                  <button type="button" onClick={handleCommentSubmit}
                    disabled={loading || !name.trim() || !email.trim() || !newComment.trim() || (!!email && !EMAIL_REGEX.test(email))}
                    className="px-12 py-3 bg-[#000080] text-white border-4 border-black text-base font-bold hover:bg-[#0000a0] disabled:opacity-40 transition-all w-full sm:w-auto shadow-[3px_3px_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                    {loading ? '发表中...' : '📨 发 表 留 言'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="h-px bg-black flex-1" />
                <span className="text-[11px] font-bold text-gray-600 tracking-widest whitespace-nowrap">已发表留言</span>
                <div className="h-px bg-black flex-1" />
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : commentTree.length === 0 ? (
                <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-400">
                  <div className="text-5xl mb-4">💬</div>
                  <div className="text-sm">还没有留言，快来抢沙发！</div>
                </div>
              ) : (
                <div className="space-y-5">
                  {commentTree.map((c, index) => (
                    <div key={c.id} className="border-2 border-black shadow-[3px_3px_0_#000] overflow-hidden">

                      {/* 楼层头部 */}
                      <div className="bg-[#000080] text-white px-4 py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <span className="bg-white text-[#000080] font-bold px-2 py-0.5 text-[10px] min-w-[32px] text-center">
                            #{commentTree.length - index}
                          </span>
                          <span className="font-bold text-sm">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="opacity-70 text-[10px]">{new Date(c.time).toLocaleString('zh-CN')}</span>
                          {isAdmin && (
                            <button onClick={() => handleDeleteComment(c)}
                              className="text-red-300 hover:text-white text-[10px] border border-red-300 hover:border-white px-1.5 py-0.5 transition-colors">
                              🗑 删除
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 留言正文 */}
                      <div className="p-5 bg-white">
                        <div className="prose prose-sm max-w-none text-base leading-relaxed break-words">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{c.content}</ReactMarkdown>
                        </div>

                        {/* 站长回复展示 */}
                        {c.reply && (
                          <div className="mt-4 pt-3 border-t border-dashed border-gray-300">
                            <div className="bg-[#eef2ff] border-l-4 border-[#000080] px-4 py-3">
                              <div className="text-[10px] font-bold text-[#000080] mb-1.5 flex items-center gap-1">
                                <span className="bg-[#000080] text-white px-1.5 py-0.5">ADMIN</span> 站长回复：
                              </div>
                              <div className="text-sm text-gray-800">{c.reply}</div>
                            </div>
                          </div>
                        )}

                        {/* 访客子回复列表 */}
                        {c.replies && c.replies.length > 0 && (
                          <div className="mt-4 space-y-2 pl-4 border-l-2 border-[#c0c0c0]">
                            {c.replies.map(r => (
                              <div key={r.id} className="bg-[#f8f8f8] border border-gray-300 p-3">
                                <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1.5">
                                  <span className="font-bold text-[#000080]">↳ {r.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span>{new Date(r.time).toLocaleString('zh-CN')}</span>
                                    {isAdmin && (
                                      <button onClick={() => handleDeleteReply(r)}
                                        className="text-red-400 hover:text-red-600 transition-colors">🗑</button>
                                    )}
                                  </div>
                                </div>
                                <div className="text-sm prose-sm">
                                  <ReactMarkdown>{String(r.content || '')}</ReactMarkdown>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 访客回复按钮 / 表单 */}
                        <div className="mt-3">
                          {visitorReplyTo?.id === c.id ? (
                            <VisitorReplyForm />
                          ) : (
                            <button onClick={() => { setVisitorReplyTo(c); setVisitorReplyText('') }}
                              className="text-xs text-[#000080] hover:underline flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                              ↩ 回复此留言
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 管理员站长回复操作区 */}
                      {isAdmin && (
                        <div className="bg-[#f0f0f0] border-t border-gray-300 px-4 py-2.5">
                          {replyingTo === c.id ? (
                            <div className="space-y-2">
                              <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                                placeholder="输入站长回复（保存后自动发邮件通知）..."
                                className="w-full p-2 border border-black text-sm bg-white resize-none h-20 focus:outline-none focus:border-[#000080]" autoFocus />
                              <div className="flex gap-2 text-xs">
                                <button onClick={() => handleAdminReply(c)} disabled={sendingReply || !replyText.trim()}
                                  className="px-4 py-1.5 bg-[#000080] text-white font-bold border border-black hover:bg-[#0000c0] disabled:opacity-50">
                                  {sendingReply ? '发送中...' : '✉️ 保存回复并发邮件'}
                                </button>
                                <button onClick={() => { setReplyingTo(null); setReplyText('') }}
                                  className="px-4 py-1.5 bg-gray-400 text-white font-bold border border-black">取消</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setReplyingTo(c.id); setReplyText(c.reply || '') }}
                              className="text-xs text-[#000080] hover:underline font-bold flex items-center gap-1">
                              {c.reply ? '✏️ 修改站长回复' : '✉️ 站长回复（发邮件通知）'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      <footer className="border-t-4 border-[#808080] mt-12">
        {/* 建议08: 友情链接区 */}
        <div className="bg-[#e8e8e8] border-b-2 border-[#808080] px-6 py-5">
          <div className="max-w-4xl mx-auto">
            <div className="text-xs font-bold text-gray-600 mb-3 tracking-widest">🔗 一些链接 / Blogroll</div>
            <div className="flex flex-wrap gap-3">
              {[
                { name: 'GitHub', url: 'https://github.com/BareerahBenjamin' },
                { name: 'X / Twitter', url: 'https://x.com/EASTERN_Z_CHILD' },
                { name: 'Ethereum.org', url: 'https://ethereum.org' },
                { name: 'Vitalik\'s Blog', url: 'https://vitalik.eth.limo' },
                /*{ name: 'Supabase', url: 'https://supabase.com' },*/
              ].map(({ name, url }) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[#0000cc] hover:text-[#cc0000] underline border border-[#808080] px-3 py-1 bg-white hover:bg-[#f0f0f0] shadow-[1px_1px_0_#808080] transition-colors">
                  {name}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="text-center py-6 text-xs text-gray-600">
          © 2026 Bareerah • All Rights Reserved
          <span onClick={() => {
            const pass = prompt('请输入管理员密码：')
            if (pass === import.meta.env.VITE_ADMIN_PASSWORD) { setIsAdmin(true); localStorage.setItem('bbs_admin', 'true'); alert('✅ 已进入管理员模式') }
            else if (pass !== null) { alert('密码错误') }
          }} className="cursor-default hover:text-black transition-colors ml-1">.</span>
          {isAdmin && (
            <button onClick={() => { setIsAdmin(false); localStorage.removeItem('bbs_admin') }} className="ml-4 text-red-500 hover:underline cursor-pointer">[退出管理员]</button>
          )}
        </div>
      </footer>
      {/* ── 浮动音乐播放器 ─────────────────────────────── */}
      {/*
        ★ 配置说明：
        【网易云】将下方 NETEASE_SONG_ID 替换为歌曲/歌单 ID
          - 歌曲：打开网易云网页版，地址栏 ?id=XXXXXXX 即为 ID，type=2
          - 歌单：歌单页地址栏 ?id=XXXXXXX，type=0
        【Spotify】将 SPOTIFY_PLAYLIST_ID 替换为歌单/单曲 ID
          - 右键歌单 → 分享 → 复制链接，链接末尾的字符串即为 ID
      */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

        {/* 展开后的播放器面板 */}
        {playerOpen && (
          <div className="border-4 border-black shadow-[4px_4px_0_#000] overflow-hidden w-[330px]">
            {/* 面板标题栏 */}
            <div className="bg-[#000080] text-white px-3 py-1.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px]">♪ 正在播放</span>
                {/* 切换源按钮 */}
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => setPlayerSource('netease')}
                    className={`px-2 py-0.5 text-[9px] border transition-colors ${playerSource === 'netease' ? 'bg-white text-[#000080] border-white' : 'border-white/50 hover:border-white'}`}
                  >
                    网易云
                  </button>
                  <button
                    onClick={() => setPlayerSource('spotify')}
                    className={`px-2 py-0.5 text-[9px] border transition-colors ${playerSource === 'spotify' ? 'bg-white text-[#000080] border-white' : 'border-white/50 hover:border-white'}`}
                  >
                    Spotify
                  </button>
                </div>
              </div>
              <button onClick={() => setPlayerOpen(false)} className="hover:text-yellow-300 text-base leading-none">×</button>
            </div>

            {/* 播放器 iframe */}
            {playerSource === 'netease' ? (
              <iframe
                title="网易云音乐"
                frameBorder="no"
                marginWidth="0"
                marginHeight="0"
                width="330"
                height="110"
                /* ↓↓↓ 把 type=0 改成 type=2 可以播放单曲，id 换成你的歌单/歌曲 ID ↓↓↓ */
                src="//music.163.com/outchain/player?type=0&id=17870929430&auto=0&height=90"
              />
            ) : (
              <iframe
                title="Spotify"
                style={{ borderRadius: 0 }}
                src="https://open.spotify.com/playlist/6Dhv2FRclwORWFYymvkG4H?si=FtvYE5WpQ0ePJYKJaSlTYg&pi=ZtD2leYZRwWc3"
                /* ↑↑↑ 把 playlist/XXXXXX 换成你自己的歌单 ID ↑↑↑ */
                width="330"
                height="152"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            )}
          </div>
        )}

        {/* 收起状态的悬浮按钮 */}
        <button
          onClick={() => setPlayerOpen(v => !v)}
          className={`
            w-12 h-12 border-4 border-black shadow-[3px_3px_0_#000]
            text-xl font-bold flex items-center justify-center
            transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
            ${playerOpen ? 'bg-[#000080] text-white' : 'bg-[#c0c0c0] text-black hover:bg-[#d0d0d0]'}
          `}
          title={playerOpen ? '收起播放器' : '打开音乐播放器'}
        >
          {playerOpen ? '♪' : '♫'}
        </button>
      </div>
    </div>
  )
}

export default App
