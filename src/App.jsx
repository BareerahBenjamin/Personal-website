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

function App() {
  const [activeTab, setActiveTab] = useState('首页')
  const [posts, setPosts] = useState([]) // 动态从 Supabase 加载
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [selectedPost, setSelectedPost] = useState(null)
  const [editingPost, setEditingPost] = useState(null) // 编辑模式
  const [newPostMode, setNewPostMode] = useState(false) // 新建模式
  const [editedTitle, setEditedTitle] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [editedDate, setEditedDate] = useState('')
  const [editedTags, setEditedTags] = useState('')
  const [isAdmin, setIsAdmin] = useState(false) // 是否编辑模式
  const [loading, setLoading] = useState(false)

  // 留言表单字段
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [remember, setRemember] = useState(false)

  const [postComments, setPostComments] = useState([]); // 当前帖子的评论列表
  const [newPostComment, setNewPostComment] = useState(''); // 新评论输入框

  const [onlineCount, setOnlineCount] = useState(1);
  const [filterTag, setFilterTag] = useState('全部'); // 当前选中的分类

  const tabs = ['首页', '个人简介', '我的日志', '留言板']

  // 1. 使用 useMemo 提取所有唯一标签，生成分类列表
  const allTags = useMemo(() => {
    const tags = posts.flatMap(p => Array.isArray(p.tags) ? p.tags : []);
    return ['全部', ...new Set(tags)];
  }, [posts]);

  // 2. 使用 useMemo 处理过滤后的日志列表
  const filteredPosts = useMemo(() => {
    return filterTag === '全部' 
      ? posts 
      : posts.filter(p => Array.isArray(p.tags) && p.tags.includes(filterTag));
  }, [posts, filterTag]);

  // 修改导航栏点击事件，增加 setFilterTag('全部') 以便在切换页面时重置筛选
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedPost(null);
    setEditingPost(null);
    setNewPostMode(false);
    setFilterTag('全部'); // 切换 Tab 时重置筛选
  };

  // 实时在线人数统计
  useEffect(() => {
    // 创建一个名为 'room-1'（或任意名称）的频道
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          // 给每个连接分配一个随机 key，防止多个标签页被计为同一个
          key: 'user-' + Math.random().toString(36).substr(2, 9),
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState()
        // 获取当前在线的总连接数
        const count = Object.keys(newState).length
        setOnlineCount(count)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 订阅成功后，开始跟踪当前用户的在线状态
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    // 组件卸载时取消订阅
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // 加载日志 from Supabase
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

  // 记住个人信息
  useEffect(() => {
    const saved = localStorage.getItem('bbs_user')
    if (saved) {
      const { name: sName, email: sEmail, website: sWebsite, remember: sRemember } = JSON.parse(saved)
      setName(sName || '')
      setEmail(sEmail || '')
      setWebsite(sWebsite || '')
      setRemember(!!sRemember)
    }
  }, [])

  // 留言板实时加载 + 订阅
  useEffect(() => {
    if (activeTab !== '留言板') return

    const fetchComments = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) console.error(error)
      else setComments(data || [])
      setLoading(false)
    }

    fetchComments()

    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setComments(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [activeTab])

  useEffect(() => {
    if (!selectedPost?.id) {
      setPostComments([]);
      return;
    }

    const fetchPostComments = async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('log_id', selectedPost.id)
        .order('created_at', { ascending: true });
      
      if (!error) setPostComments(data || []);
    };

    fetchPostComments();
  }, [selectedPost]);

  // 发表留言
  const handleCommentSubmit = async () => {
    if (!name.trim() || !email.trim() || !newComment.trim()) {
      alert('昵称、电子邮件和留言不能为空')
      return
    }

    setLoading(true)
    const { error } = await supabase
      .from('messages')
      .insert([{
        name: name.trim(),
        email: email.trim(),
        website: website.trim() || null,
        content: newComment.trim()
      }])

    if (error) {
      alert('发表失败，请稍后再试')
      console.error(error)
    } else {
      if (remember) {
        localStorage.setItem('bbs_user', JSON.stringify({ name: name.trim(), email: email.trim(), website: website.trim(), remember: true }))
      } else {
        localStorage.removeItem('bbs_user')
      }
      setNewComment('')
    }
    setLoading(false)
  }

  // 查看日志全文 + 增量浏览量
  const handlePostClick = async (post) => {
    setSelectedPost(post)
    // 增量 views
    const { error } = await supabase.rpc('increment_views', { log_id: post.id })
    if (error) console.error(error)
    else {
      // 更新本地 posts
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, views: p.views + 1 } : p))
    }
  }

  const closePost = () => setSelectedPost(null)

  // 开始编辑
  const startEdit = (post) => {
    setEditingPost(post)
    setNewPostMode(false)
    setEditedTitle(post.title)
    setEditedContent(post.content)
    setEditedDate(post.date)
    setEditedTags(post.tags ? post.tags.join(', ') : '')
  }

  // 开始新建
  const startNewPost = () => {
    setNewPostMode(true)
    setEditingPost(null)
    setEditedTitle('')
    setEditedContent('')
    setEditedDate(new Date().toISOString().slice(0, 10)) // 默认今天
    setEditedTags('')
  }

  const handleDeletePost = async (id) => {
    if (!window.confirm('真的要删除这篇日志吗？此操作不可逆哦！')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('logs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // 更新 UI
      setPosts(prev => prev.filter(p => p.id !== id));
      setSelectedPost(null);
      alert('日志已删除');
      setActiveTab('我的日志');
    } catch (err) {
      alert(`删除失败：${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 保存编辑或新建
  const saveEdit = async () => {
      // 1. 基础检查
      if (!editedTitle.trim() || !editedContent.trim() || !editedDate.trim()) {
        alert('标题、内容和日期不能为空！');
        return;
      }

      setLoading(true);
      // 处理标签：将字符串转为数组，并去掉多余空格
      const newTags = editedTags.split(',').map(t => t.trim()).filter(t => t);

      try {
        if (newPostMode) {
          // --- 【模式 A：新建日志】 ---
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
            .select(); //  关键：必须 select 才能拿到包含 ID 的新行数据

          if (error) throw error;

          if (data) {
            setPosts(prev => [data[0], ...prev]); // 把新帖子塞到列表最前面
            alert('日志发布成功！');
          }
        } else {
          // --- 【模式 B：编辑日志】 ---
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
            .select(); // 关键：确保拿到服务器更新后的最新时间戳等数据

          if (error) throw error;

          if (data) {
            // 同步更新列表状态
            setPosts(prev => prev.map(p => p.id === data[0].id ? data[0] : p));
            // 如果当前正开着详情页，同步更新内容
            if (selectedPost?.id === data[0].id) {
              setSelectedPost(data[0]);
            }
            alert('修改已保存！');
          }
        }

        // 操作成功后退出编辑状态
        setNewPostMode(false);
        setEditingPost(null);

      } catch (err) {
        console.error('BBS Error:', err);
        alert(`操作失败，原因：${err.message || '网络或权限问题'}`);
      } finally {
        setLoading(false);
      }
    };

    const handlePostCommentSubmit = async () => {
      //  校验：确保名字、邮箱、内容都不为空
      if (!name.trim() || !email.trim() || !newPostComment.trim()) {
        alert('昵称、电子邮件和留言内容不能为空');
        return;
      }

      const { data, error } = await supabase
        .from('post_comments')
        .insert([{
          log_id: selectedPost.id,
          name: name.trim(),
          email: email.trim(), //  提交邮箱
          content: newPostComment.trim()
        }])
        .select();

      if (!error && data) {
        setPostComments(prev => [...prev, data[0]]);
        setNewPostComment('');
        // 如果用户勾选了记住信息（复用留言板的remember逻辑），可以在此处保存到localStorage
        if (remember) {
          localStorage.setItem('bbs_user', JSON.stringify({ name, email, website, remember: true }));
        }
      } else {
        alert('发布失败，请检查数据库设置');
      }
    };

  // 检查本地 admin
  useEffect(() => {
    if (localStorage.getItem('bbs_admin') === 'true') setIsAdmin(true)
  }, [])

  return (
    <div className="min-h-screen bg-[#c0c0c0] font-bbs text-black">
      {/* 头部 */}
      <header className="forum-header py-6">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-widest">Bareerah 的小屋</h1>
            <p className="text-sm mt-1 opacity-90">海椰的个人网站</p>
          </div>
          <div className="text-right text-xs">
            欢迎光临<br />
            当前在线：{onlineCount}
          </div>
        </div>
      </header>

      {/* 导航栏 */}
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
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="forum-main p-8 min-h-[70vh]">

          {/* 首页 */}
          {activeTab === '首页' && (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-[#000080] text-white rounded-full flex items-center justify-center text-5xl mb-6">🐱</div>
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

          {/* 个人简介 */}
          {activeTab === '个人简介' && (
            <div>
              <h2 className="text-2xl border-b-4 border-black pb-2 mb-6">关于我</h2>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/3">
                  <div className="bg-[#000080] text-white p-6 text-center">
                    <div className="w-32 h-32 mx-auto bg-white rounded-full overflow-hidden border-4 border-white">
                      <img src="https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/person/Avatar.jpg" alt="头像" className="w-full h-full object-cover" />
                    </div>
                    <p className="mt-4 font-bold">海椰<br/>Bareerah</p>
                    <p className="text-xs opacity-75">深圳 / 香港 </p>
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
                    <a href="https://x.com/EASTERN_Z_CHILD" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-red-600 underline transition-colors">X</a> | <a href="https://github.com/BareerahBenjamin" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-red-600 underline transition-colors">GitHub</a><br/>
                    Email: bareerahmoooo@gmail.com <br />
                    
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 我的日志 */}
          {activeTab === '我的日志' && (
            selectedPost ? (
              /* --- 1. 帖子详情视图 --- */
              <div>
                <button 
                  onClick={closePost} 
                  className="bbs-link mb-6 text-sm hover:underline"
                >
                  ← 返回日志列表
                </button>
                <div className="post p-8 bg-white border-2 border-black shadow-[4px_4px_0_#000]">
                  <div className="text-2xl font-bold border-b-2 border-black pb-4">{selectedPost.title}</div>
                  <div className="text-xs text-gray-600 mt-2 mb-8">发布日期：{selectedPost.date}</div>
                  
                  {/* 帖子正文展示 */}
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
                        code({ node, inline, className, children, ...props }) {
                          // 提取语言名称，例如从 "language-javascript" 中提取 "javascript"
                          const match = /language-(\w+)/.exec(className || '');
                          const langName = match ? match[1] : '';

                          return !inline ? (
                            <div className="code-block-wrapper">
                              {langName && (
                                <div className="code-lang-tag">
                                  {langName.toUpperCase()}
                                </div>
                              )}
                              <pre className={className}>
                                <code {...props}>{children}</code>
                              </pre>
                            </div>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {String(selectedPost?.content || '')} 
                    </ReactMarkdown>
                  </div>

                  {/* --- 帖子独立讨论区 --- */}
                  <div className="mt-12 border-t-2 border-black pt-8">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <span className="bg-[#000080] text-white px-2 py-0.5 text-sm italic">RE:</span> 讨论区
                    </h3>
                    
                    {/* 评论列表 */}
                    <div className="space-y-4 mb-8">
                      {postComments.length === 0 ? (
                        <p className="text-gray-500 italic text-sm">暂无回帖，欢迎留言！</p>
                      ) : (
                        postComments.map(c => (
                          <div key={c.id} className="bg-[#f5f5f5] p-4 border border-black shadow-[2px_2px_0_#000]">
                            <div className="flex justify-between text-[10px] mb-2 border-b border-gray-300 pb-1">
                              <span className="font-bold text-[#000080]">访客: {c.name}</span>
                              <span>{new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <div className="text-sm prose-sm">
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
                            <label className="block text-xs font-bold mb-1">您的昵称：</label>
                            <input 
                              type="text" 
                              value={name} 
                              onChange={(e) => setName(e.target.value)} 
                              className="w-full p-2 border border-black bg-white text-sm focus:outline-none" 
                              placeholder="必填" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">电子邮件：</label>
                            <input 
                              type="email" 
                              value={email} 
                              onChange={(e) => setEmail(e.target.value)} 
                              className="w-full p-2 border border-black bg-white text-sm focus:outline-none" 
                              placeholder="不公开" 
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button 
                            onClick={handlePostCommentSubmit}
                            className="px-10 py-2 bg-white border-2 border-black text-xs font-bold hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_#000] active:translate-y-0.5 active:shadow-none"
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
                    <button 
                      onClick={() => startEdit(selectedPost)}
                      className="mt-4 px-6 py-2 bg-[#000080] text-white font-bold border-2 border-black hover:bg-[#0000c0]"
                    >
                      编辑此日志
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* --- 2. 日志列表视图 --- */
              <div>
                <h2 className="text-2xl border-b-4 border-black pb-2 mb-6">我的日志（Blog）</h2>
                
                {/* 操作与筛选栏 */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  {isAdmin && (
                    <button 
                      onClick={startNewPost}
                      className="px-6 py-2 bg-[#000080] text-white font-bold border-2 border-black hover:bg-[#0000c0] shadow-[2px_2px_0_#000]"
                    >
                      新建日志 +
                    </button>
                  )}

                  {/* 动态分类筛选器 */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold mr-1">分类:</span>
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setFilterTag(tag)}
                        className={`px-3 py-1 text-[10px] border-2 transition-all ${
                          (filterTag === tag) 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white text-black border-gray-400 hover:border-black'
                        }`}
                      >
                        {tag === '全部' ? 'ALL' : `#${tag}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 过滤后的日志列表 */}
                <div className="space-y-6">
                  {filteredPosts.map(post => (
                    <div
                      key={post.id}
                      onClick={() => handlePostClick(post)}
                      className="post p-6 cursor-pointer bg-white border-2 border-black hover:bg-[#f0f0f0] transition-all group shadow-[3px_3px_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-lg font-bold group-hover:underline text-[#000080]">{post.title}</div>
                          <div className="text-[10px] text-gray-500 mt-1">{post.date} • 浏览 {post.views}</div>
                        </div>
                        <div className="flex gap-1">
                          {Array.isArray(post.tags) ? post.tags.map(tag => (
                            <span 
                              key={tag} 
                              className={`px-2 py-0.5 text-[9px] border ${filterTag === tag ? 'bg-black text-white' : 'border-gray-400 bg-gray-50'}`}
                            >
                              #{tag}
                            </span>
                          )) : null}
                        </div>
                      </div>
                        
                        {/* Markdown 预览 */}
                        <div className="mt-3 text-sm line-clamp-3 overflow-hidden opacity-80 prose prose-sm pointer-events-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {String(post.content || '').substring(0, 180) + (post.content?.length > 180 ? '...' : '')}
                          </ReactMarkdown>
                        </div>
                        
                        <div className="text-[10px] text-[#0000ff] mt-4 font-bold italic">READ MORE →</div>
                      </div>
                    ))}
                    
                  {/* 空状态处理 */}
                  {filteredPosts.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-gray-400 text-gray-500 italic">
                      该分类下暂时没有内容哦...
                    </div>
                  )}
                </div>
              </div>
            )
          )}


          {/* 编辑/新建模态 */}
          {(editingPost || newPostMode) && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-8 border-4 border-black max-w-2xl w-full mx-4">
                <h3 className="text-xl font-bold mb-4">{newPostMode ? '新建日志' : '编辑日志'}</h3>
                <input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="标题"
                  className="w-full p-2 border-2 border-black mb-4"
                />
                <input
                  type="date"
                  value={editedDate}
                  onChange={(e) => setEditedDate(e.target.value)}
                  className="w-full p-2 border-2 border-black mb-4"
                />
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder="内容 (支持 Markdown)"
                  className="w-full h-64 p-2 border-2 border-black mb-4"
                />
                <input
                  value={editedTags}
                  onChange={(e) => setEditedTags(e.target.value)}
                  placeholder="标签 (逗号分隔，如 Web3, DevRel)"
                  className="w-full p-2 border-2 border-black mb-4"
                />
                <div className="flex gap-4">
                  <button onClick={saveEdit} className="px-6 py-2 bg-[#000080] text-white font-bold">保存</button>
                  <button onClick={() => { setNewPostMode(false); setEditingPost(null) }} className="px-6 py-2 bg-gray-500 text-white font-bold">取消</button>
              
                  {!newPostMode && (
                    <button 
                      onClick={() => handleDeletePost(editingPost.id)} 
                      className="px-6 py-2 bg-red-600 text-white font-bold ml-auto"
                    >
                      删除此帖
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 留言板 */}
          {activeTab === '留言板' && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl border-b-4 border-black pb-3 mb-8">留言板</h2>
              
              <div className="bg-[#f8f4e8] border-4 border-[#808080] p-8 shadow-[3px_3px_0_#000]">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold mb-2">您的留言 （支持 Markdown + HTML）</label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="在这里畅所欲言... 支持 **加粗**、*斜体*、[链接](url)、```代码块``` 等 Markdown 语法"
                      className="w-full h-48 p-4 border-2 border-black bg-white resize-y focus:outline-none text-base"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1">您的昵称：</label>
                    <div className="flex items-center gap-3">
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 p-3 border-2 border-black bg-white focus:outline-none" placeholder="请输入昵称" required />
                      <span className="text-xs text-gray-500 whitespace-nowrap">必填</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1">电子邮件：</label>
                    <div className="flex items-center gap-3">
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 p-3 border-2 border-black bg-white focus:outline-none" placeholder="example@email.com" required />
                      <span className="text-xs text-gray-500 whitespace-nowrap">必填，不公开</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input type="checkbox" id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-5 h-5 border-2 border-black accent-black" />
                    <label htmlFor="remember" className="text-sm cursor-pointer">记住个人信息？</label>
                  </div>

                  <button
                    type="button"
                    onClick={handleCommentSubmit}
                    disabled={loading || !name.trim() || !email.trim() || !newComment.trim()}
                    className="mt-4 px-12 py-4 bg-white border-4 border-black text-xl font-bold hover:bg-[#e0e0e0] active:bg-[#c0c0c0] disabled:opacity-50 transition-all w-full sm:w-auto"
                  >
                    发表
                  </button>
                </div>
              </div>

              <h3 className="text-xl border-b-4 border-black pb-2 mt-12 mb-6">已发表留言</h3>
              {loading ? (
                <div className="text-center py-8">加载中...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">还没有留言，快来抢沙发！</div>
              ) : (
                <div className="space-y-6">
                  {comments.map(c => (
                    <div key={c.id} className="post p-6">
                      <div className="flex justify-between items-center text-xs text-gray-600 mb-3 border-b pb-2">
                        <div>
                          <span className="font-bold">{c.name}</span>
                          {c.website && (
                            <span className="ml-3">
                              <a href={c.website} target="_blank" rel="noopener noreferrer" className="bbs-link">
                                {c.website.replace(/^https?:\/\//, '')}
                              </a>
                            </span>
                          )}
                        </div>
                        <span>{new Date(c.created_at).toLocaleString('zh-CN')}</span>
                      </div>
                      <div className="prose prose-sm max-w-none text-base leading-relaxed break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                          {c.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 管理员登录（如果未登录） */}      
      <footer className="text-center py-8 text-xs text-gray-600 border-t-4 border-[#808080] mt-12">
        © 2026 Bareerah • All Rights Reserved
        <span 
          onClick={() => {
            const pass = prompt('请输入管理员密码：');
            if (pass === import.meta.env.VITE_ADMIN_PASSWORD) {
              setIsAdmin(true);
              localStorage.setItem('bbs_admin', 'true');
            }
          }}
          className="cursor-default hover:text-black transition-colors ml-1"
        >
          .
        </span>
      </footer>
    </div>
  )
}

export default App
