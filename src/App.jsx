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

// ✅ FIX 3: 邮箱格式正则
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

  // 留言表单字段
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [remember, setRemember] = useState(false)

  const [postComments, setPostComments] = useState([])
  const [newPostComment, setNewPostComment] = useState('')
  const [onlineCount, setOnlineCount] = useState(1)
  const [filterTag, setFilterTag] = useState('全部')

  // ✅ FIX 2: 管理员回复状态
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const tabs = ['首页', '个人简介', '我的日志', '留言板']

  const allTags = useMemo(() => {
    const tags = posts.flatMap(p => Array.isArray(p.tags) ? p.tags : [])
    return ['全部', ...new Set(tags)]
  }, [posts])

  const filteredPosts = useMemo(() => {
    return filterTag === '全部'
      ? posts
      : posts.filter(p => Array.isArray(p.tags) && p.tags.includes(filterTag))
  }, [posts, filterTag])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSelectedPost(null)
    setEditingPost(null)
    setNewPostMode(false)
    setFilterTag('全部')
  }

  // 实时在线人数
  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: 'user-' + Math.random().toString(36).substr(2, 9),
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState()
        setOnlineCount(Object.keys(newState).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  // 加载日志
  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .order('date', { ascending: false })
      if (error) console.error(error)
      else setPosts(data || [])
    }
    fetchPosts()
  }, [])

  // 记住个人信息（修复了原来 !sRemember 的逻辑错误）
  useEffect(() => {
    const saved = localStorage.getItem('bbs_user')
    if (saved) {
      const { name: sName, email: sEmail, website: sWebsite, remember: sRemember } = JSON.parse(saved)
      setName(sName || '')
      setEmail(sEmail || '')
      setWebsite(sWebsite || '')
      setRemember(sRemember || false) // ✅ 修复：去掉原来多余的取反
    }
  }, [])

  // 留言板实时加载 + 订阅
  useEffect(() => {
    if (activeTab !== '留言板') return

    const fetchComments = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('message')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) console.error(error)
      else setComments(data || [])
      setLoading(false)
    }

    fetchComments()

    const channel = supabase
      .channel('message-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message' }, (payload) => {
        // 防止与 .select() 手动插入重复
        setComments(prev => {
          const exists = prev.some(c => c.id === payload.new.id)
          return exists ? prev : [payload.new, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message' }, (payload) => {
        // ✅ FIX 2: 实时同步站长回复
        setComments(prev => prev.map(c => c.id === payload.new.id ? payload.new : c))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [activeTab])

  // 加载帖子评论
  useEffect(() => {
    if (!selectedPost?.id) {
      setPostComments([])
      return
    }

    const fetchPostComments = async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('log_id', selectedPost.id)
        .order('created_at', { ascending: true })

      if (!error) setPostComments(data || [])
    }

    fetchPostComments()
  }, [selectedPost])

  // ✅ FIX 1 + FIX 3: 发表留言（修复 insert 不显示 + 邮箱格式校验）
  const handleCommentSubmit = async () => {
    if (!name.trim() || !email.trim() || !newComment.trim()) {
      alert('昵称、电子邮件和留言不能为空')
      return
    }

    // ✅ FIX 3: 邮箱格式校验
    if (!EMAIL_REGEX.test(email.trim())) {
      alert('请输入有效的电子邮件格式，例如：example@gmail.com')
      return
    }

    setLoading(true)

    // ✅ FIX 1: 加 .select() 拿到插入后的数据，立即更新本地 state，不再完全依赖实时订阅
    const { data, error } = await supabase
      .from('message')
      .insert([{
        name: name.trim(),
        email: email.trim(),
        website: website.trim() || null,
        content: newComment.trim()
      }])
      .select()

    if (error) {
      alert(`发表失败：${error.message}`)
      console.error(error)
    } else {
      if (data && data[0]) {
        setComments(prev => {
          // 防止实时订阅和手动插入重复
          const exists = prev.some(c => c.id === data[0].id)
          return exists ? prev : [data[0], ...prev]
        })
      }
      if (remember) {
        localStorage.setItem('bbs_user', JSON.stringify({
          name: name.trim(), email: email.trim(), website: website.trim(), remember: true
        }))
      } else {
        localStorage.removeItem('bbs_user')
      }
      setNewComment('')
    }
    setLoading(false)
  }

  // ✅ FIX 3: 帖子评论也加邮箱格式校验
  const handlePostCommentSubmit = async () => {
    if (!name.trim() || !email.trim() || !newPostComment.trim()) {
      alert('昵称、电子邮件和留言内容不能为空')
      return
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      alert('请输入有效的电子邮件格式，例如：example@gmail.com')
      return
    }

    const { data, error } = await supabase
      .from('post_comments')
      .insert([{
        log_id: selectedPost.id,
        name: name.trim(),
        email: email.trim(),
        content: newPostComment.trim()
      }])
      .select()

    if (!error && data) {
      setPostComments(prev => [...prev, data[0]])
      setNewPostComment('')
      if (remember) {
        localStorage.setItem('bbs_user', JSON.stringify({ name, email, website, remember: true }))
      }
    } else {
      alert('发布失败，请检查数据库设置')
    }
  }

  // ✅ FIX 2: 管理员回复 + 邮件通知（调用 Supabase Edge Function）
  const handleAdminReply = async (comment) => {
    if (!replyText.trim()) {
      alert('回复内容不能为空')
      return
    }

    setSendingReply(true)
    try {
      // 1. 将回复内容保存到数据库（需要 messages 表有 reply 列，详见配套 SQL）
      const { error: updateError } = await supabase
        .from('message')
        .update({ reply: replyText.trim() })
        .eq('id', comment.id)

      if (updateError) throw updateError

      // 2. 调用 Edge Function 发送邮件
      const { error: fnError } = await supabase.functions.invoke('send-reply-email', {
        body: {
          to: comment.email,
          name: comment.name,
          originalMessage: comment.content,
          reply: replyText.trim()
        }
      })

      if (fnError) {
        console.warn('邮件发送失败（回复已保存到数据库）：', fnError)
        alert(`回复已保存，但邮件发送失败：${fnError.message}\n请检查 Edge Function 和 RESEND_API_KEY 配置`)
      } else {
        alert(`✅ 回复已发送，并已邮件通知 ${comment.name}（${comment.email}）`)
      }

      // 3. 更新本地状态
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, reply: replyText.trim() } : c))
      setReplyingTo(null)
      setReplyText('')
    } catch (err) {
      alert(`操作失败：${err.message}`)
    } finally {
      setSendingReply(false)
    }
  }

  const handlePostClick = async (post) => {
    setSelectedPost(post)
    const { error } = await supabase.rpc('increment_views', { log_id: post.id })
    if (error) console.error(error)
    else setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: p.views + 1 } : p))
  }

  const closePost = () => setSelectedPost(null)

  const startEdit = (post) => {
    setEditingPost(post)
    setNewPostMode(false)
    setEditedTitle(post.title)
    setEditedContent(post.content)
    setEditedDate(post.date)
    setEditedTags(post.tags ? post.tags.join(', ') : '')
  }

  const startNewPost = () => {
    setNewPostMode(true)
    setEditingPost(null)
    setEditedTitle('')
    setEditedContent('')
    setEditedDate(new Date().toISOString().slice(0, 10))
    setEditedTags('')
  }

  const handleDeletePost = async (id) => {
    if (!window.confirm('真的要删除这篇日志吗？此操作不可逆哦！')) return

    setLoading(true)
    try {
      const { error } = await supabase.from('logs').delete().eq('id', id)
      if (error) throw error
      setPosts(prev => prev.filter(p => p.id !== id))
      setSelectedPost(null)
      alert('日志已删除')
      setActiveTab('我的日志')
    } catch (err) {
      alert(`删除失败：${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const saveEdit = async () => {
    if (!editedTitle.trim() || !editedContent.trim() || !editedDate.trim()) {
      alert('标题、内容和日期不能为空！')
      return
    }

    setLoading(true)
    const newTags = editedTags.split(',').map(t => t.trim()).filter(t => t)

    try {
      if (newPostMode) {
        const { data, error } = await supabase
          .from('logs')
          .insert([{
            title: editedTitle.trim(),
            content: editedContent.trim(),
            date: editedDate,
            tags: newTags,
            views: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()

        if (error) throw error
        if (data) {
          setPosts(prev => [data[0], ...prev])
          alert('日志发布成功！')
        }
      } else {
        const { data, error } = await supabase
          .from('logs')
          .update({
            title: editedTitle.trim(),
            content: editedContent.trim(),
            date: editedDate,
            tags: newTags,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPost.id)
          .select()

        if (error) throw error
        if (data) {
          setPosts(prev => prev.map(p => p.id === data[0].id ? data[0] : p))
          if (selectedPost?.id === data[0].id) setSelectedPost(data[0])
          alert('修改已保存！')
        }
      }

      setNewPostMode(false)
      setEditingPost(null)
    } catch (err) {
      console.error('BBS Error:', err)
      alert(`操作失败，原因：${err.message || '网络或权限问题'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (localStorage.getItem('bbs_admin') === 'true') setIsAdmin(true)
  }, [])

  return (
    <div className="min-h-screen bg-[#c0c0c0] font-bbs text-black">

      {/* ── 头部 ─────────────────────────────── */}
      <header className="forum-header py-6">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-widest">Bareerah 的小屋</h1>
            <p className="text-sm mt-1 opacity-90">海椰的个人网站</p>
          </div>
          <div className="text-right text-xs opacity-80">
            欢迎光临<br />
            当前在线：<span className="font-bold text-yellow-300">{onlineCount}</span>
          </div>
        </div>
      </header>

      {/* ── 导航栏 ────────────────────────────── */}
      <nav className="forum-nav py-3 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-8 py-2 text-sm border-2 transition-all whitespace-nowrap
                ${activeTab === tab
                  ? 'bg-white border-b-0 border-[#000080] text-black font-bold'
                  : 'bg-[#c0c0c0] border-[#000] hover:bg-[#dfdfdf]'}`}
            >
              {tab}
            </button>
          ))}
          {isAdmin && (
            <span className="ml-auto text-xs text-yellow-200 self-center px-2 border border-yellow-300 opacity-75">
              🔑 管理员
            </span>
          )}
        </div>
      </nav>

      {/* ── 主内容区 ──────────────────────────── */}
      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* 管理员编辑器（浮动面板） */}
        {(newPostMode || editingPost) && (
          <div className="mb-8 p-6 bg-[#fffbe6] border-4 border-[#808080] shadow-[4px_4px_0_#000]">
            <h3 className="text-lg font-bold mb-4 border-b-2 border-black pb-2 flex items-center gap-2">
              <span className="bg-[#000080] text-white px-2 py-0.5 text-sm">ADMIN</span>
              {newPostMode ? '新建日志' : '编辑日志'}
            </h3>
            <input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder="标题"
              className="w-full p-2 border-2 border-black mb-4 focus:outline-none focus:border-[#000080]"
            />
            <input
              type="date"
              value={editedDate}
              onChange={(e) => setEditedDate(e.target.value)}
              className="w-full p-2 border-2 border-black mb-4 focus:outline-none"
            />
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="内容 (支持 Markdown)"
              className="w-full h-64 p-2 border-2 border-black mb-4 focus:outline-none"
            />
            <input
              value={editedTags}
              onChange={(e) => setEditedTags(e.target.value)}
              placeholder="标签 (逗号分隔，如 Web3, DevRel)"
              className="w-full p-2 border-2 border-black mb-4 focus:outline-none"
            />
            <div className="flex gap-4">
              <button onClick={saveEdit} disabled={loading} className="px-6 py-2 bg-[#000080] text-white font-bold border-2 border-black hover:bg-[#0000c0] disabled:opacity-50">
                {loading ? '保存中...' : '保存'}
              </button>
              <button onClick={() => { setNewPostMode(false); setEditingPost(null) }} className="px-6 py-2 bg-gray-500 text-white font-bold border-2 border-black">
                取消
              </button>
              {!newPostMode && (
                <button onClick={() => handleDeletePost(editingPost.id)} className="px-6 py-2 bg-red-600 text-white font-bold border-2 border-black ml-auto">
                  删除此帖
                </button>
              )}
            </div>
          </div>
        )}

        <div className="forum-main p-8 min-h-[70vh]">

          {/* ── 首页 ─── */}
          {activeTab === '首页' && (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-[#000080] text-white rounded-full flex items-center justify-center text-5xl mb-6 shadow-[4px_4px_0_#000]">🐱</div>
              <h2 className="text-3xl mb-4">欢迎来到我的个人网站</h2>
              <p className="text-lg max-w-md mx-auto">
                这里记录我对学习、生活的一些思考。<br />
                欢迎交流～
              </p>
              <div className="mt-10 text-sm text-gray-600">
                最新更新：{posts[0]?.title} • {posts[0]?.date}
              </div>
            </div>
          )}

          {/* ── 个人简介 ─── */}
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
                    <strong>技术栈：</strong><br />
                    Python，React<br />
                    熟悉Web3基础、AI Agent测试
                  </div>
                  <div>
                    <strong>联系方式：</strong><br />
                    <a href="https://x.com/EASTERN_Z_CHILD" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-red-600 underline transition-colors">X</a>
                    {' | '}
                    <a href="https://github.com/BareerahBenjamin" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-red-600 underline transition-colors">GitHub</a><br />
                    Email: bareerahmoooo@gmail.com
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 我的日志 ─── */}
          {activeTab === '我的日志' && (
            selectedPost ? (
              <div>
                <button onClick={closePost} className="bbs-link mb-6 text-sm hover:underline">
                  ← 返回日志列表
                </button>
                <div className="post p-8 bg-white border-2 border-black shadow-[4px_4px_0_#000]">
                  <div className="text-2xl font-bold border-b-2 border-black pb-4">{selectedPost.title}</div>
                  <div className="text-xs text-gray-600 mt-2 mb-8">发布日期：{selectedPost.date}</div>

                  <div className="prose prose-slate lg:prose-lg max-w-none my-8
                                  prose-headings:font-bold prose-headings:text-black
                                  prose-p:text-gray-800
                                  prose-ul:list-disc prose-ul:pl-5
                                  prose-ol:list-decimal prose-ol:pl-5
                                  prose-blockquote:border-l-4 prose-blockquote:border-gray-300">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        img: ({ node, ...props }) => (
                          <img style={{ maxWidth: '100%', height: 'auto' }} className="my-4 border-2 border-black" {...props} />
                        ),
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '')
                          const langName = match ? match[1] : ''
                          return !inline ? (
                            <div className="code-block-wrapper">
                              {langName && <div className="code-lang-tag">{langName.toUpperCase()}</div>}
                              <pre className={className}><code {...props}>{children}</code></pre>
                            </div>
                          ) : (
                            <code className={className} {...props}>{children}</code>
                          )
                        }
                      }}
                    >
                      {String(selectedPost?.content || '')}
                    </ReactMarkdown>
                  </div>

                  {/* 讨论区 */}
                  <div className="mt-12 border-t-2 border-black pt-8">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <span className="bg-[#000080] text-white px-2 py-0.5 text-sm italic">RE:</span> 讨论区
                    </h3>

                    <div className="space-y-4 mb-8">
                      {postComments.length === 0 ? (
                        <p className="text-gray-500 italic text-sm">暂无回帖，欢迎留言！</p>
                      ) : (
                        postComments.map((c, index) => (
                          <div key={c.id} className="bg-[#f5f5f5] border border-black shadow-[2px_2px_0_#000]">
                            <div className="bg-[#000080] text-white px-3 py-1.5 flex justify-between text-[10px]">
                              <span className="font-bold">#{index + 1} 访客: {c.name}</span>
                              <span className="opacity-75">{new Date(c.created_at).toLocaleString('zh-CN')}</span>
                            </div>
                            <div className="p-4 text-sm prose-sm">
                              <ReactMarkdown>{String(c.content || '')}</ReactMarkdown>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 评论表单 */}
                    <div className="bg-[#dfdfdf] p-6 border-2 border-black shadow-[3px_3px_0_#000]">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold mb-1">您的留言：</label>
                          <textarea
                            value={newPostComment}
                            onChange={(e) => setNewPostComment(e.target.value)}
                            placeholder="支持 Markdown 语法..."
                            className="w-full h-24 p-2 border border-black text-sm focus:outline-none bg-white resize-none"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold mb-1">昵称：</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                              className="w-full p-2 border border-black bg-white text-sm focus:outline-none" placeholder="必填" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">电子邮件：</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                              className={`w-full p-2 border bg-white text-sm focus:outline-none ${email && !EMAIL_REGEX.test(email) ? 'border-red-500' : 'border-black'}`}
                              placeholder="不公开" />
                            {/* ✅ FIX 3: 实时邮箱格式提示 */}
                            {email && !EMAIL_REGEX.test(email) && (
                              <p className="text-red-600 text-[10px] mt-0.5">邮箱格式不正确</p>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={handlePostCommentSubmit}
                            disabled={!name.trim() || !email.trim() || !newPostComment.trim() || (!!email && !EMAIL_REGEX.test(email))}
                            className="px-10 py-2 bg-white border-2 border-black text-xs font-bold hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_#000] active:translate-y-0.5 active:shadow-none disabled:opacity-40"
                          >
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
                    <button onClick={() => startEdit(selectedPost)}
                      className="mt-4 px-6 py-2 bg-[#000080] text-white font-bold border-2 border-black hover:bg-[#0000c0]">
                      编辑此日志
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl border-b-4 border-black pb-2 mb-6">我的日志（Blog）</h2>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  {isAdmin && (
                    <button onClick={startNewPost}
                      className="px-6 py-2 bg-[#000080] text-white font-bold border-2 border-black hover:bg-[#0000c0] shadow-[2px_2px_0_#000]">
                      新建日志 +
                    </button>
                  )}
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
                  {filteredPosts.map(post => (
                    <div key={post.id} onClick={() => handlePostClick(post)}
                      className="post p-6 cursor-pointer bg-white border-2 border-black hover:bg-[#f0f0f0] transition-all group shadow-[3px_3px_0_#000] active:translate-x-0.5 active:translate-y-0.5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-lg font-bold group-hover:underline text-[#000080]">{post.title}</div>
                          <div className="text-[10px] text-gray-500 mt-1">{post.date} • 浏览 {post.views}</div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {Array.isArray(post.tags) ? post.tags.map(tag => (
                            <span key={tag} className={`px-2 py-0.5 text-[9px] border ${filterTag === tag ? 'bg-black text-white border-black' : 'bg-[#e8e8e8] text-gray-600 border-gray-400'}`}>
                              #{tag}
                            </span>
                          )) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* ✅ FIX 1 + 2 + 3 + 4: 留言板 ─────────────────── */}
          {activeTab === '留言板' && (
            <div className="max-w-2xl mx-auto">

              {/* ✅ FIX 4: BBS 风格标题栏 */}
              <div className="bg-[#000080] text-white px-6 py-3 flex items-center justify-between border-2 border-b-0 border-black shadow-[3px_0px_0_#000]">
                <h2 className="text-lg font-bold tracking-widest">📋 留言板 / Message Board</h2>
                <span className="text-xs opacity-75 border border-white/40 px-2 py-0.5">
                  共 {comments.length} 楼
                </span>
              </div>

              {/* 发表留言表单 */}
              <div className="bg-[#f8f4e8] border-4 border-[#808080] p-8 shadow-[3px_3px_0_#000] mb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold mb-2">✏️ 您的留言（支持 Markdown + HTML）</label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="在这里畅所欲言... 支持 **加粗**、*斜体*、[链接](url)、```代码块``` 等 Markdown 语法"
                      className="w-full h-40 p-4 border-2 border-black bg-white resize-y focus:outline-none focus:border-[#000080] text-base transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-1">
                        昵称 <span className="text-red-600 font-normal text-xs">* 必填</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-3 border-2 border-black bg-white focus:outline-none focus:border-[#000080] transition-colors"
                        placeholder="请输入昵称"
                      />
                    </div>
                    <div>
                      {/* ✅ FIX 3: 实时邮箱格式校验 + 红色边框反馈 */}
                      <label className="block text-sm font-bold mb-1">
                        电子邮件 <span className="text-red-600 font-normal text-xs">* 必填，不公开</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full p-3 border-2 bg-white focus:outline-none transition-colors ${
                          email && !EMAIL_REGEX.test(email)
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-black focus:border-[#000080]'
                        }`}
                        placeholder="example@email.com"
                      />
                      {email && !EMAIL_REGEX.test(email) && (
                        <p className="text-red-600 text-xs mt-1">⚠ 请输入有效的邮箱格式</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 border-2 border-black accent-black"
                    />
                    <label htmlFor="remember" className="text-sm cursor-pointer select-none">记住我的信息</label>
                  </div>

                  <button
                    type="button"
                    onClick={handleCommentSubmit}
                    disabled={loading || !name.trim() || !email.trim() || !newComment.trim() || (!!email && !EMAIL_REGEX.test(email))}
                    className="px-12 py-3 bg-[#000080] text-white border-4 border-black text-base font-bold
                               hover:bg-[#0000a0] active:bg-[#000060] disabled:opacity-40
                               transition-all w-full sm:w-auto shadow-[3px_3px_0_#000]
                               active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    {loading ? '发表中...' : '📨 发 表 留 言'}
                  </button>
                </div>
              </div>

              {/* 留言列表分隔线 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px bg-black flex-1" />
                <span className="text-[11px] font-bold text-gray-600 tracking-widest whitespace-nowrap">已发表留言</span>
                <div className="h-px bg-black flex-1" />
              </div>

              {/* ✅ FIX 1: 留言加载 & 显示 */}
              {loading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-400">
                  <div className="text-5xl mb-4">💬</div>
                  <div className="text-sm">还没有留言，快来抢沙发！</div>
                </div>
              ) : (
                <div className="space-y-5">
                  {comments.map((c, index) => (
                    <div key={c.id} className="border-2 border-black shadow-[3px_3px_0_#000] overflow-hidden">

                      {/* ✅ FIX 4: BBS 楼层头部 */}
                      <div className="bg-[#000080] text-white px-4 py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          {/* 楼层编号 */}
                          <span className="bg-white text-[#000080] font-bold px-2 py-0.5 text-[10px] min-w-[32px] text-center">
                            #{comments.length - index}
                          </span>
                          <span className="font-bold text-sm">{c.name}</span>
                          {c.website && (
                            <a href={c.website} target="_blank" rel="noopener noreferrer"
                              className="opacity-70 hover:opacity-100 underline text-[10px]"
                              onClick={(e) => e.stopPropagation()}>
                              🔗 {c.website.replace(/^https?:\/\//, '').slice(0, 24)}
                            </a>
                          )}
                        </div>
                        <span className="opacity-70 text-[10px] whitespace-nowrap ml-2">
                          {new Date(c.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>

                      {/* 留言正文 */}
                      <div className="p-5 bg-white">
                        <div className="prose prose-sm max-w-none text-base leading-relaxed break-words">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {c.content}
                          </ReactMarkdown>
                        </div>

                        {/* ✅ FIX 2 + FIX 4: 站长回复展示区 */}
                        {c.reply && (
                          <div className="mt-4 pt-3 border-t border-dashed border-gray-300">
                            <div className="bg-[#eef2ff] border-l-4 border-[#000080] px-4 py-3">
                              <div className="text-[10px] font-bold text-[#000080] mb-1.5 flex items-center gap-1">
                                <span className="bg-[#000080] text-white px-1.5 py-0.5">ADMIN</span>
                                站长回复：
                              </div>
                              <div className="text-sm text-gray-800">{c.reply}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ✅ FIX 2: 管理员回复操作区 */}
                      {isAdmin && (
                        <div className="bg-[#f0f0f0] border-t border-gray-300 px-4 py-2.5">
                          {replyingTo === c.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="输入回复内容（保存后会自动发邮件通知留言人）..."
                                className="w-full p-2 border border-black text-sm bg-white resize-none h-20 focus:outline-none focus:border-[#000080]"
                                autoFocus
                              />
                              <div className="flex gap-2 text-xs">
                                <button
                                  onClick={() => handleAdminReply(c)}
                                  disabled={sendingReply || !replyText.trim()}
                                  className="px-4 py-1.5 bg-[#000080] text-white font-bold border border-black hover:bg-[#0000c0] disabled:opacity-50 transition-colors"
                                >
                                  {sendingReply ? '发送中...' : '✉️ 保存回复并发邮件'}
                                </button>
                                <button
                                  onClick={() => { setReplyingTo(null); setReplyText('') }}
                                  className="px-4 py-1.5 bg-gray-400 text-white font-bold border border-black hover:bg-gray-500"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setReplyingTo(c.id); setReplyText(c.reply || '') }}
                              className="text-xs text-[#000080] hover:underline font-bold flex items-center gap-1"
                            >
                              {c.reply ? '✏️ 修改回复' : '↩ 回复此留言（发邮件通知）'}
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

      {/* ── Footer ───────────────────────────── */}
      <footer className="text-center py-8 text-xs text-gray-600 border-t-4 border-[#808080] mt-12">
        © 2026 Bareerah • All Rights Reserved
        <span
          onClick={() => {
            const pass = prompt('请输入管理员密码：')
            if (pass === import.meta.env.VITE_ADMIN_PASSWORD) {
              setIsAdmin(true)
              localStorage.setItem('bbs_admin', 'true')
              alert('✅ 已进入管理员模式')
            } else if (pass !== null) {
              alert('密码错误')
            }
          }}
          className="cursor-default hover:text-black transition-colors ml-1"
        >
          .
        </span>
        {isAdmin && (
          <button
            onClick={() => { setIsAdmin(false); localStorage.removeItem('bbs_admin') }}
            className="ml-4 text-red-500 hover:underline cursor-pointer"
          >
            [退出管理员]
          </button>
        )}
      </footer>
    </div>
  )
}

export default App
