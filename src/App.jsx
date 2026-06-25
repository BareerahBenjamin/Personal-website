import { createClient } from '@supabase/supabase-js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks'
import { useState, useEffect, useMemo, useRef } from 'react'
import Intro from "./Intro"

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

const PLAYLIST = [
  { title: 'come close (feat. Ayra Starr)', artist: 'CKay,Ayra Starr', src: 'https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/music/CKay,Ayra%20Starr%20-%20come%20close%20(feat.%20Ayra%20Starr).mp3' },
  { title: 'Horses to Water', artist: 'Joji', src: 'https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/music/Joji%20-%20Horses%20to%20Water.mp3' },
  { title: '电动少女 (Live版)', artist: 'Chinese Football', src: 'https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/music/Chinese%20Football.mp3' },
  { title: 'Hype Boy', artist: 'Newjeans X 山下達郎', src: 'https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/music/Hype%20Boy.mp3' },
  { title: '落日', artist: '東京事変', src: 'https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/music/Fallen%20sun.mp3' },
  { title: '白日梦', artist: '红白色乐队', src: 'https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/music/redwhite%20-%20orange.mp3' },
  { title: '橙子', artist: '红白色乐队', src: 'https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/music/redwhite%20-%20dream.mp3' },
  { title: '住进你的行李 (A Plus Ver.) - (Sami (A Plus Ver.))', artist: '甜約翰 Sweet John', src: 'https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/music/Sweet%20John%20-%20luggage%20(A%20Plus%20Ver.)%20-%20(Sami%20(A%20Plus%20Ver.)).mp3' },
  { title: '冬眠', artist: '郑宜农 X 安溥', src: 'https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/music/winter.mp3' },
  
]

// ── 2c. 终端反馈组件 ────────────────────────────────
function TerminalFeedback({ message, visible }) {
  const [displayText, setDisplayText] = useState('')
  const [fading, setFading] = useState(false)
  useEffect(() => {
    if (!visible) { setDisplayText(''); setFading(false); return }
    setFading(false)
    let i = 0
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const fullText = `> ${message}\n> TIMESTAMP: ${timestamp}`
    const interval = setInterval(() => {
      i++
      setDisplayText(fullText.slice(0, i))
      if (i >= fullText.length) {
        clearInterval(interval)
        setTimeout(() => setFading(true), 1500)
      }
    }, 30)
    return () => clearInterval(interval)
  }, [visible, message])
  if (!visible) return null
  return (
    <div className={`bg-black text-[#00cc44] font-bbs text-xs p-3 border border-[#00cc44] mb-2 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}>
      <pre className="whitespace-pre-wrap">{displayText}<span className="terminal-cursor">█</span></pre>
    </div>
  )
}

function App() {

  const[showIntro, setShowIntro] = useState(
    () => !sessionStorage.getItem('intro_seen')
  )

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
  const [editedPrivate, setEditedPrivate] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)

  // AI 补全状态
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiAbortRef = useRef(null)
  const textareaRef = useRef(null)
  const aiDebounceRef = useRef(null)

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

  // 项目展示
  const [projects, setProjects] = useState([])
  const [editingProject, setEditingProject] = useState(null)
  const [newProjectMode, setNewProjectMode] = useState(false)
  const [projectForm, setProjectForm] = useState({
    name: '', description: '', tech_stack: '', github_url: '', demo_url: '', cover_url: '', sort_order: 0
  })

  // Tab 切换动画
  const [tabAnimState, setTabAnimState] = useState('active')

  // 猫咪彩蛋
  const catClicksRef = useRef([])
  const [catActivated, setCatActivated] = useState(false)

  // 终端反馈
  const [msgTerminalFeedback, setMsgTerminalFeedback] = useState({ visible: false, message: '' })
  const [postTerminalFeedback, setPostTerminalFeedback] = useState({ visible: false, message: '' })

  // 音乐播放器
  const audioRef = useRef(null)
  const [playerOpen, setPlayerOpen] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const currentSong = PLAYLIST[currentIndex]

  const togglePlay = () => {
    if (!audioRef.current) return
    isPlaying ? audioRef.current.pause() : audioRef.current.play()
  }

  const playNext = () => setCurrentIndex(i => (i + 1) % PLAYLIST.length)
  const playPrev = () => setCurrentIndex(i => (i - 1 + PLAYLIST.length) % PLAYLIST.length)

  const tabs = ['首页', '我的日志', '留言板', '个人简介']

  const allTags = useMemo(() => {
    const tags = posts.flatMap(p => Array.isArray(p.tags) ? p.tags : [])
    return ['全部', ...new Set(tags)]
  }, [posts])

  const filteredPosts = useMemo(() => {
    const visible = isAdmin ? posts : posts.filter(p => !p.is_private)
    return filterTag === '全部' ? visible : visible.filter(p => Array.isArray(p.tags) && p.tags.includes(filterTag))
  }, [posts, filterTag, isAdmin])

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

  // 切歌时自动播放
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.load()
    if (isPlaying) audioRef.current.play()
  }, [currentIndex])

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

  // 项目展示数据
  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase.from('projects').select('*').order('sort_order')
      if (data) setProjects(data)
    }
    fetchProjects()
  }, [])

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
      setMsgTerminalFeedback({ visible: true, message: 'MESSAGE SENT SUCCESSFULLY ✓' })
      setTimeout(() => setMsgTerminalFeedback({ visible: false, message: '' }), 2500)
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
      setPostTerminalFeedback({ visible: true, message: 'COMMENT POSTED SUCCESSFULLY ✓' })
      setTimeout(() => setPostTerminalFeedback({ visible: false, message: '' }), 2500)
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
    if (post.is_private && !isAdmin) return
    setSelectedPost(post)
    const { error } = await supabase.rpc('increment_views', { log_id: post.id })
    if (!error) setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: p.views + 1 } : p))
  }

  const closePost = () => setSelectedPost(null)

  const startEdit = (post) => {
    setEditingPost(post); setNewPostMode(false)
    setEditedTitle(post.title); setEditedContent(post.content)
    setEditedDate(post.date); setEditedTags(post.tags ? post.tags.join(', ') : '')
    setEditedPrivate(post.is_private || false)
  }

  const startNewPost = () => {
    setNewPostMode(true); setEditingPost(null); setEditedTitle(''); setEditedContent('')
    setEditedDate(new Date().toISOString().slice(0, 10)); setEditedTags(''); setEditedPrivate(false)
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
          .insert([{ title: editedTitle.trim(), content: editedContent.trim(), date: editedDate, tags: newTags, views: 0, is_private: editedPrivate, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]).select()
        if (error) throw error
        if (data) { setPosts(prev => [data[0], ...prev]); alert('日志发布成功！') }
      } else {
        const { data, error } = await supabase.from('logs')
          .update({ title: editedTitle.trim(), content: editedContent.trim(), date: editedDate, tags: newTags, is_private: editedPrivate, updated_at: new Date().toISOString() })
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

  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.1 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [activeTab])
  
  // ── 辅助函数 ────────────────────────────────────────
  // AI 补全处理
  const handleEditorChange = (e) => {
    const val = e.target.value
    setEditedContent(val)
    setAiSuggestion('')
    clearTimeout(aiDebounceRef.current)
    aiDebounceRef.current = setTimeout(() => {
      fetchAiCompletion(val, e.target.selectionStart)
    }, 1500)
  }

  const handleEditorKeyDown = (e) => {
    if (e.key === 'Tab' && aiSuggestion) {
      e.preventDefault()
      const ta = textareaRef.current
      const pos = ta.selectionStart
      const before = editedContent.slice(0, pos)
      const after = editedContent.slice(ta.selectionEnd)
      const newVal = before + aiSuggestion + after
      setEditedContent(newVal)
      setAiSuggestion('')
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = pos + aiSuggestion.length
        ta.focus()
      })
    } else if (e.key === 'Escape' && aiSuggestion) {
      e.preventDefault()
      setAiSuggestion('')
    }
  }

  const fetchAiCompletion = async (content, cursorPos) => {
    if (!content.trim() || content.length < 20) return
    if (aiAbortRef.current) aiAbortRef.current.abort()
    aiAbortRef.current = new AbortController()
    setAiLoading(true)
    try {
      const textBeforeCursor = content.slice(0, cursorPos)
      const { data, error } = await supabase.functions.invoke('ai-complete', {
        body: { prefix: textBeforeCursor }
      })
      if (error) throw error
      if (data?.completion) setAiSuggestion(data.completion)
    } catch (err) {
      if (err.name !== 'AbortError') console.error('AI completion error:', err)
    } finally {
      setAiLoading(false)
    }
  }
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

  // ── 项目展示 CRUD ────────────────────────────────────
  const handleSaveProject = async () => {
    const payload = {
      ...projectForm,
      tech_stack: projectForm.tech_stack.split(',').map(s => s.trim()).filter(Boolean),
      sort_order: Number(projectForm.sort_order) || 0
    }
    if (editingProject) {
      await supabase.from('projects').update(payload).eq('id', editingProject.id)
    } else {
      await supabase.from('projects').insert(payload)
    }
    const { data } = await supabase.from('projects').select('*').order('sort_order')
    if (data) setProjects(data)
    setEditingProject(null); setNewProjectMode(false)
    setProjectForm({ name: '', description: '', tech_stack: '', github_url: '', demo_url: '', cover_url: '', sort_order: 0 })
  }

  const handleDeleteProject = async (id) => {
    if (!confirm('确定删除此项目？')) return
    await supabase.from('projects').delete().eq('id', id)
    const { data } = await supabase.from('projects').select('*').order('sort_order')
    if (data) setProjects(data)
  }

  const startEditProject = (p) => {
    setEditingProject(p); setNewProjectMode(false)
    setProjectForm({ ...p, tech_stack: p.tech_stack?.join(', ') || '' })
  }

  // ── 2a. 像素涟漪 ────────────────────────────────────
  const PIXEL_COLORS = ['#000080', '#00cc44', '#ff0000', '#ffcc00']
  const handlePixelRipple = (e) => {
    // 不在表单元素上触发
    if (['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(e.target.tagName)) return
    const burst = document.createElement('span')
    burst.className = 'pixel-burst'
    burst.style.left = `${e.clientX - 4}px`
    burst.style.top = `${e.clientY - 4}px`
    burst.style.background = PIXEL_COLORS[Math.floor(Math.random() * PIXEL_COLORS.length)]
    document.body.appendChild(burst)
    burst.addEventListener('animationend', () => burst.remove())
  }

  // ── 2b. Tab 切换动画 ────────────────────────────────
  const handleTabChangeAnimated = (tab) => {
    setTabAnimState('entering')
    setTimeout(() => {
      handleTabChange(tab)
      setTabAnimState('active')
    }, 50)
  }

  // ── 2f. 猫咪彩蛋 ────────────────────────────────────
  const handleCatClick = (e) => {
    e.stopPropagation()
    const now = Date.now()
    catClicksRef.current.push(now)
    catClicksRef.current = catClicksRef.current.filter(t => now - t < 2000)
    if (catClicksRef.current.length >= 5) {
      catClicksRef.current = []
      setCatActivated(true)
      const fishEmojis = ['🐟', '🐠', '🐡', '🦈', '🐙', '🦀']
      const rect = e.target.getBoundingClientRect()
      fishEmojis.forEach((fish, i) => {
        const el = document.createElement('span')
        el.textContent = fish
        el.style.cssText = `
          position:fixed;left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 2}px;
          font-size:24px;pointer-events:none;z-index:10000;
          --fx:${Math.cos(i * Math.PI / 3) * 120}px;--fy:${Math.sin(i * Math.PI / 3) * 120}px;
          animation:fish-fly 1s ease-out forwards;
        `
        document.body.appendChild(el)
        el.addEventListener('animationend', () => el.remove())
      })
      setTimeout(() => setCatActivated(false), 3000)
    }
  }

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
    <div onClick={handlePixelRipple} className="min-h-screen bg-[#c0c0c0] font-bbs text-black">

      {showIntro && (
        <Intro onEnter={() => {
          sessionStorage.setItem('intro_seen', '1')
          setShowIntro(false);
        }}/>
      )}

      <header className="forum-header py-6">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-widest" style={{animation:'title-flicker 9s infinite'}}>
              Bareerah 的小屋
              <span className="pixel-cursor" />
            </h1>
            <p className="text-sm mt-1 opacity-90">海椰的个人网站</p>
          </div>
          <div className="text-right text-xs opacity-80">
            欢迎光临<br />
            <span className="online-dot" />
            当前在线：<span className="font-bold text-yellow-300">{onlineCount}</span>
          </div>
        </div>
      </header>

      <nav className="forum-nav py-3 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 flex gap-2 overflow-x-auto items-center">
          {tabs.map(tab => (
            <button key={tab} onClick={() => handleTabChangeAnimated(tab)}
              className={`px-8 py-2 text-sm border-2 transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white border-b-0 border-[#000080] text-black font-bold' : 'bg-[#c0c0c0] border-[#000] hover:bg-[#dfdfdf]'}`}>
              {tab}
            </button>
          ))}
          {isAdmin && <span className="ml-auto text-xs text-yellow-200 self-center px-2 border border-yellow-300 opacity-75">🔑 管理员</span>}
        </div>
      </nav>

      <main className={`max-w-4xl mx-auto px-6 py-8 tab-content ${tabAnimState}`}>

        {(newPostMode || editingPost) && (
          <div className="mb-8 p-6 bg-[#fffbe6] border-4 border-[#808080] shadow-[4px_4px_0_#000]">
            <h3 className="text-lg font-bold mb-4 border-b-2 border-black pb-2 flex items-center gap-2">
              <span className="bg-[#000080] text-white px-2 py-0.5 text-sm">ADMIN</span>
              {newPostMode ? '新建日志' : '编辑日志'}
            </h3>
            <input value={editedTitle} onChange={e => setEditedTitle(e.target.value)} placeholder="标题" className="w-full p-2 border-2 border-black mb-4 focus:outline-none" />
            <input type="date" value={editedDate} onChange={e => setEditedDate(e.target.value)} className="w-full p-2 border-2 border-black mb-4 focus:outline-none" />
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" id="post-private" checked={editedPrivate} onChange={e => setEditedPrivate(e.target.checked)} className="w-4 h-4 border-2 border-black accent-black" />
              <label htmlFor="post-private" className="text-sm select-none cursor-pointer">🔒 私密文章（仅管理员可见）</label>
            </div>
            <div className="relative mb-4">
              <textarea ref={textareaRef} value={editedContent} onChange={handleEditorChange} onKeyDown={handleEditorKeyDown} placeholder="内容 (支持 Markdown)" className="w-full h-64 p-2 border-2 border-black focus:outline-none resize-y" />
              {aiSuggestion && (
                <div className="ai-suggestion-bar">
                  <span className="ai-suggestion-text">{aiSuggestion}</span>
                  <span className="ai-suggestion-hint">Tab 接受 · Esc 忽略</span>
                </div>
              )}
              {aiLoading && (
                <div className="ai-loading-bar">
                  <span>思考中...</span>
                </div>
              )}
            </div>
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
              <div className="text-center py-10 reveal">
                <div className="mx-auto w-24 h-24 bg-[#000080] text-white rounded-full flex items-center justify-center text-5xl mb-6 shadow-[4px_4px_0_#000]">
                  <span onClick={handleCatClick} className={`cursor-pointer inline-block ${catActivated ? 'cat-activated' : ''}`} style={{ lineHeight: 1 }}>🐱</span>
                </div>
                {catActivated && (
                  <div className="mx-auto max-w-md bg-black text-[#00cc44] font-bbs text-xs p-3 border border-[#00cc44] mb-4">
                    <span className="terminal-cursor">&gt; CHEAT CODE ACTIVATED: +9 LIVES</span>
                  </div>
                )}
                <h2 className="text-3xl mb-4">欢迎来到我的个人网站</h2>
                <p className="text-lg max-w-md mx-auto">这里记录我对学习、生活的一些思考。<br />欢迎交流～</p>
              </div>

              {/* 建议01: 状态公告栏 */}
              <div className="border-4 border-[#808080] shadow-[3px_3px_0_#000] mb-6 overflow-hidden reveal">
                <div className="bg-[#000080] text-white px-4 py-2 text-xs font-bold flex items-center justify-between">
                  <span>📌 公告栏 / Status Board</span>
                  <div className="flex items-center gap-1">
                    <span className="opacity-50 text-[10px] mr-2">{new Date().toLocaleDateString('zh-CN')}</span>
                    {['_','□','×'].map(c => (
                      <span key={c} className="titlebar-btn">{c}</span>
                    ))}
                  </div>
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
            <div className="reveal">
              <h2 className="text-2xl border-b-4 border-black pb-2 mb-6">关于我</h2>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/3">
                  <div className="bg-[#000080] text-white p-6 text-center shadow-[4px_4px_0_#000] about-profile-card">
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
                  <div className="border-2 border-[#808080] overflow-hidden shadow-[2px_2px_0_#000] mt-4">
                    <div className="bg-[#008080] text-white px-3 py-1.5 text-xs font-bold flex justify-between items-center">
                      <span>📬 联系方式 / Contact</span>
                      <div className="flex gap-1">
                        {['_','□','×'].map(c=><span key={c} className="titlebar-btn">{c}</span>)}
                      </div>
                    </div>
                    <div className="bg-[#f0f4ff] p-3 space-y-2">
                      {[
                        { icon:'𝕏', label:'@EASTERN_Z_CHILD', href:'https://x.com/EASTERN_Z_CHILD' },
                        { icon:'GH', label:'BareerahBenjamin', href:'https://github.com/BareerahBenjamin' },
                        { icon:'✉', label:'bareerahmoooo@gmail.com', href:'mailto:bareerahmoooo@gmail.com' },
                      ].map(({ icon, label, href }) => (
                        <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="contact-row">
                          <div className="contact-icon-box">{icon}</div>
                          <span className="text-xs font-bold flex-1">{label}</span>
                          <span className="text-[10px] opacity-50">→</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 项目展示区 ── */}
              <div className="border-2 border-black shadow-[2px_2px_0_#000] bg-[#c0c0c0] mt-6">
                <div className="bg-[#000080] text-white px-3 py-1 flex justify-between items-center">
                  <span className="text-sm font-bold">📂 项目展示 / Projects</span>
                  {isAdmin && (
                    <button onClick={() => { setNewProjectMode(true); setEditingProject(null); setProjectForm({ name: '', description: '', tech_stack: '', github_url: '', demo_url: '', cover_url: '', sort_order: 0 }); }}
                      className="text-[10px] bg-[#c0c0c0] text-black border border-white px-2 hover:bg-white">+ 添加项目</button>
                  )}
                </div>
                <div className="p-4">
                  {(newProjectMode || editingProject) && (
                    <div className="border-2 border-black bg-white p-3 mb-4">
                      <h4 className="text-xs font-bold mb-2">{editingProject ? '编辑项目' : '添加项目'}</h4>
                      <input value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="项目名称" className="w-full border border-black p-1 text-xs mb-1 focus:outline-none" />
                      <textarea value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="项目简介" className="w-full border border-black p-1 text-xs mb-1 focus:outline-none" rows="2" />
                      <input value={projectForm.tech_stack} onChange={e => setProjectForm({ ...projectForm, tech_stack: e.target.value })} placeholder="技术栈（逗号分隔）" className="w-full border border-black p-1 text-xs mb-1 focus:outline-none" />
                      <input value={projectForm.github_url} onChange={e => setProjectForm({ ...projectForm, github_url: e.target.value })} placeholder="GitHub URL" className="w-full border border-black p-1 text-xs mb-1 focus:outline-none" />
                      <input value={projectForm.demo_url} onChange={e => setProjectForm({ ...projectForm, demo_url: e.target.value })} placeholder="Demo URL" className="w-full border border-black p-1 text-xs mb-1 focus:outline-none" />
                      <input value={projectForm.cover_url} onChange={e => setProjectForm({ ...projectForm, cover_url: e.target.value })} placeholder="封面图 URL" className="w-full border border-black p-1 text-xs mb-1 focus:outline-none" />
                      <input type="number" value={projectForm.sort_order} onChange={e => setProjectForm({ ...projectForm, sort_order: e.target.value })} placeholder="排序权重" className="w-full border border-black p-1 text-xs mb-2 focus:outline-none" />
                      <div className="flex gap-2">
                        <button onClick={handleSaveProject} className="bg-[#000080] text-white px-3 py-1 text-xs border border-black hover:bg-[#0000c0]">保存</button>
                        <button onClick={() => { setNewProjectMode(false); setEditingProject(null); }} className="bg-[#c0c0c0] px-3 py-1 text-xs border border-black">取消</button>
                      </div>
                    </div>
                  )}
                  {projects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {projects.map(p => (
                        <div key={p.id} className="project-card border-2 border-black shadow-[2px_2px_0_#000] bg-[#c0c0c0]">
                          <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center">
                            <span className="text-xs font-bold truncate">{p.name}</span>
                            <div className="flex gap-1">
                              <span className="titlebar-btn">_</span>
                              <span className="titlebar-btn">□</span>
                              <span className="titlebar-btn">×</span>
                            </div>
                          </div>
                          {p.cover_url && (
                            <img src={p.cover_url} alt={p.name} className="w-full h-40 object-cover border-b-2 border-black" />
                          )}
                          <div className="p-3">
                            <p className="text-xs mb-2">{p.description}</p>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {p.tech_stack?.map((tech, i) => (
                                <span key={i} className="tech-badge bg-[#ffcc00] text-black px-2 py-0.5 text-[10px] font-bold border border-black shadow-[1px_1px_0_#000]">{tech}</span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              {p.github_url && (
                                <a href={p.github_url} target="_blank" rel="noopener noreferrer"
                                  className="bg-[#c0c0c0] border-2 border-black shadow-[2px_2px_0_#000] px-3 py-1 text-xs hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#000] transition-all">GitHub →</a>
                              )}
                              {p.demo_url && (
                                <a href={p.demo_url} target="_blank" rel="noopener noreferrer"
                                  className="bg-[#c0c0c0] border-2 border-black shadow-[2px_2px_0_#000] px-3 py-1 text-xs hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#000] transition-all">Demo →</a>
                              )}
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="border-t-2 border-black p-2 flex gap-2">
                              <button onClick={() => startEditProject(p)} className="text-[10px] bg-[#c0c0c0] border border-black px-2 py-0.5 hover:bg-white">编辑</button>
                              <button onClick={() => handleDeleteProject(p.id)} className="text-[10px] bg-red-200 border border-black px-2 py-0.5 hover:bg-red-300">删除</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !newProjectMode && <p className="text-xs text-gray-500 font-bbs">暂无项目 / No projects yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === '我的日志' && (
            selectedPost ? (
              <div>
                <button onClick={closePost} className="bbs-link mb-6 text-sm hover:underline">← 返回日志列表</button>
                <div className="post p-8 bg-white border-2 border-black shadow-[4px_4px_0_#000]">
                  <div className="text-2xl font-bold border-b-2 border-black pb-4 flex items-center gap-2">
                    {selectedPost.title}
                    {selectedPost.is_private && isAdmin && (
                      <span className="text-xs bg-[#cc9900] text-white px-2 py-0.5 border border-[#996600] font-normal">🔒 私密文章</span>
                    )}
                  </div>
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
                    <TerminalFeedback message={postTerminalFeedback.message} visible={postTerminalFeedback.visible} />
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
                              {post.is_private && isAdmin && (
                                <span className="bg-[#cc9900] text-white text-[9px] font-bold px-2 py-0.5 border border-[#996600] shadow-[1px_1px_0_#500]">
                                  🔒 私密
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

              <TerminalFeedback message={msgTerminalFeedback.message} visible={msgTerminalFeedback.visible} />
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
        <div className="footer-pixel-line"></div>
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
            <button onClick={() => { setIsAdmin(false); localStorage.removeItem('bbs_admin') }} className="ml-4 text-red-500 hover:underline cursor-pointer">{'[退出管理员]'}</button>
          )}
        </div>
      </footer>
      {/* ── 浮动音乐播放器 ─────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

        {/* 展开后的播放器面板 */}
        {playerOpen && (
          <div className="border-4 border-black shadow-[4px_4px_0_#000] overflow-hidden w-[300px]">
            {/* 标题栏 */}
            <div className="bg-[#000080] text-white px-3 py-1.5 flex items-center justify-between text-xs">
              <span className="text-[10px]">♪ 正在播放 {currentIndex + 1} / {PLAYLIST.length}</span>
              <button
                onClick={() => setPlayerOpen(false)}
                className="hover:text-yellow-300 text-base leading-none"
              >×</button>
            </div>

            {/* 当前歌曲信息 */}
            <div className="bg-[#f0f0f0] px-3 pt-3 pb-1">
              <div className="text-xs font-bold text-[#000080] truncate">🎵 {currentSong.title}</div>
              <div className="text-[10px] text-gray-500 truncate">{currentSong.artist}</div>
            </div>

            {/* 控制按钮 */}
            <div className="bg-[#f0f0f0] px-3 pb-3 flex items-center justify-center gap-3 mt-1">
              <button onClick={playPrev}
                className="w-8 h-8 bg-[#c0c0c0] border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-center text-sm active:translate-x-px active:translate-y-px active:shadow-none">
                ⏮
              </button>
              <button onClick={togglePlay}
                className="w-10 h-10 bg-[#000080] text-white border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-center text-base active:translate-x-px active:translate-y-px active:shadow-none">
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button onClick={playNext}
                className="w-8 h-8 bg-[#c0c0c0] border-2 border-black shadow-[2px_2px_0_#000] flex items-center justify-center text-sm active:translate-x-px active:translate-y-px active:shadow-none">
                ⏭
              </button>
            </div>

            {/* 歌单列表 */}
            <div className="border-t-2 border-black max-h-[150px] overflow-y-auto">
              {PLAYLIST.map((song, i) => (
                <div key={i} onClick={() => { setCurrentIndex(i); setIsPlaying(true) }}
                  className={`px-3 py-2 text-xs cursor-pointer flex items-center gap-2 border-b border-gray-300 hover:bg-[#e0e0ff] transition-colors
                    ${i === currentIndex ? 'bg-[#000080] text-white' : 'bg-white text-black'}`}>
                  <span>{i === currentIndex && isPlaying ? '♪' : `${i + 1}.`}</span>
                  <span className="truncate">{song.title}</span>
                  <span className={`ml-auto text-[9px] shrink-0 ${i === currentIndex ? 'text-white/70' : 'text-gray-400'}`}>{song.artist}</span>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* audio 放在面板外，关闭面板时不会被卸载，音乐继续播放 */}
        <audio
          ref={audioRef}
          src={currentSong.src}
          loop={PLAYLIST.length === 1}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={playNext}
        />

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
