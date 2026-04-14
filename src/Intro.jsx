import { useEffect, useState, useRef } from 'react'

const LINES = [
  { text: 'ATZ',                          cls: 'gray',   delay: 300  },
  { text: 'OK',                           cls: 'white',  delay: 600  },
  { text: 'ATDT bareerahsite.dpdns.org',  cls: 'gray',   delay: 900  },
  { text: '正在拨号...',                   cls: 'white',  delay: 1500 },
  { text: 'CONNECT 56000/ARQ/V90/LAPM',   cls: 'cyan',   delay: 2400 },
  { text: '协议握手中... TCP/IP v4',       cls: 'white',  delay: 2900 },
  { text: '身份验证通过 ✓',                cls: 'green',  delay: 3400 },
  { text: '欢迎回来，海椰 🐱',            cls: 'bright', delay: 3900 },
]

const PROGRESS = [
  { label: '初始化调制解调器...', pct: 10,  delay: 400  },
  { label: '拨号连接中...',       pct: 30,  delay: 1000 },
  { label: '建立 TCP 连接...',    pct: 55,  delay: 2000 },
  { label: '身份验证...',         pct: 75,  delay: 2800 },
  { label: '加载页面资源...',     pct: 92,  delay: 3300 },
  { label: '连接成功！',          pct: 100, delay: 3900 },
]

const COLOR = {
  gray:   '#446644',
  white:  '#b0b0b0',
  cyan:   '#00bbcc',
  green:  '#00cc44',
  bright: '#00ff66',
}

export default function Intro({ onEnter }) {
  const [visibleLines, setVisibleLines] = useState([])
  const [progPct, setProgPct]           = useState(0)
  const [progLabel, setProgLabel]       = useState('初始化...')
  const [showSignal, setShowSignal]     = useState(false)
  const [showBtns, setShowBtns]         = useState(false)
  const termRef = useRef(null)

  useEffect(() => {
    const timers = []

    LINES.forEach(({ delay }, i) => {
      timers.push(setTimeout(() => {
        setVisibleLines(v => [...v, i])
        if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
      }, delay))
    })

    PROGRESS.forEach(({ label, pct, delay }) => {
      timers.push(setTimeout(() => {
        setProgPct(pct)
        setProgLabel(label)
      }, delay))
    })

    timers.push(setTimeout(() => {
      setShowSignal(true)
      setShowBtns(true)
    }, 4100))

    return () => timers.forEach(clearTimeout)
  }, [])

  // 任意键触发
  useEffect(() => {
    if (!showBtns) return
    const handler = () => onEnter()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showBtns, onEnter])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#008080',
      backgroundImage: 'radial-gradient(rgba(0,0,0,0.15) 1px, transparent 1px)',
      backgroundSize: '6px 6px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New', monospace",
      padding: 24,
    }}>

      {/* Win95 窗口 */}
      <div style={{
        width: 440, background: '#c0c0c0',
        borderTop: '2px solid #ffffff', borderLeft: '2px solid #ffffff',
        borderRight: '2px solid #404040', borderBottom: '2px solid #404040',
        boxShadow: '3px 3px 0 black',
        animation: 'winPop 0.18s cubic-bezier(0.2,1.4,0.6,1) both',
      }}>

        {/* 标题栏 */}
        <div style={{
          background: '#000080', color: 'white',
          padding: '4px 8px', fontSize: 13, fontWeight: 'bold',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          userSelect: 'none',
        }}>
          <span>🔌 正在连接 — bareerahsite.dpdns.org</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {['_', '□', '×'].map(c => (
              <div key={c} style={{
                width: 16, height: 14, background: '#c0c0c0',
                borderTop: '1px solid white', borderLeft: '1px solid white',
                borderRight: '1px solid #404040', borderBottom: '1px solid #404040',
                fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'default', color: 'black',
              }}>{c}</div>
            ))}
          </div>
        </div>

        {/* 图标行 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px 10px',
          borderBottom: '2px solid #808080',
          boxShadow: '0 1px 0 white',
        }}>
          <div style={{
            width: 40, height: 40, background: '#000080', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, border: '2px solid #404040', flexShrink: 0,
          }}>🐱</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>海椰の小屋 · Personal Site</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>拨号网络连接程序 v2.0.26</div>
          </div>
        </div>

        {/* 终端输出 */}
        <div ref={termRef} style={{
          background: '#0a0a14', margin: '10px 14px',
          borderTop: '2px solid #404040', borderLeft: '2px solid #404040',
          borderRight: '2px solid #e0e0e0', borderBottom: '2px solid #e0e0e0',
          padding: '10px 12px', minHeight: 148,
          overflow: 'hidden', position: 'relative',
        }}>
          {/* 扫描线 */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,200,68,0.025) 2px,rgba(0,200,68,0.025) 4px)',
          }} />

          {LINES.map((line, i) => visibleLines.includes(i) && (
            <div key={i} style={{
              fontSize: 12, lineHeight: 1.85, whiteSpace: 'pre',
              color: COLOR[line.cls] ?? '#00cc44',
              fontWeight: line.cls === 'bright' ? 'bold' : 'normal',
              position: 'relative', zIndex: 1,
            }}>
              {line.text}
            </div>
          ))}

          {/* 光标 */}
          {showBtns && (
            <span style={{
              display: 'inline-block', width: 8, height: 13,
              background: '#00cc44', verticalAlign: 'middle',
              animation: 'blink 0.8s step-end infinite',
            }} />
          )}
        </div>

        {/* 进度条 */}
        <div style={{ padding: '0 14px 10px' }}>
          <div style={{
            fontSize: 11, color: '#333', marginBottom: 4,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{progLabel}</span>
            <span>{progPct}%</span>
          </div>
          <div style={{
            height: 18,
            borderTop: '2px solid #808080', borderLeft: '2px solid #808080',
            borderRight: '2px solid white', borderBottom: '2px solid white',
            background: 'white', padding: 2,
          }}>
            <div style={{
              height: '100%', background: '#000080',
              width: progPct + '%', transition: 'width 0.15s linear',
            }} />
          </div>
        </div>

        {/* 信号强度 */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 3,
          padding: '0 14px 12px',
          opacity: showSignal ? 1 : 0,
          transition: 'opacity 0.3s',
        }}>
          {[6, 11, 17, 11, 6].map((h, i) => (
            <div key={i} style={{
              width: 7, height: h, background: '#00cc44',
              animation: `sWave 0.7s ${i * 0.12}s ease-in-out infinite alternate`,
            }} />
          ))}
          <span style={{ fontSize: 11, color: '#00cc44', marginLeft: 8 }}>
            56,000 bps · 连接稳定
          </span>
        </div>

        {/* 按钮行 */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '6px 14px 14px',
          borderTop: '2px solid #808080',
          boxShadow: '0 -1px 0 white inset',
        }}>
          {[
            { label: '取消', primary: false },
            { label: '进入网站 ▶', primary: true },
          ].map(({ label, primary }) => (
            <button
              key={label}
              onClick={primary ? onEnter : undefined}
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 12, padding: '4px 20px', minWidth: 80,
                background: '#c0c0c0',
                borderTop: '2px solid white', borderLeft: '2px solid white',
                borderRight: '2px solid #404040', borderBottom: '2px solid #404040',
                cursor: primary ? 'pointer' : 'default',
                fontWeight: primary ? 'bold' : 'normal',
                opacity: showBtns ? 1 : 0,
                transition: 'opacity 0.2s',
              }}
              onMouseDown={e => {
                e.currentTarget.style.borderTop = '2px solid #404040'
                e.currentTarget.style.borderLeft = '2px solid #404040'
                e.currentTarget.style.borderRight = '2px solid white'
                e.currentTarget.style.borderBottom = '2px solid white'
              }}
              onMouseUp={e => {
                e.currentTarget.style.borderTop = '2px solid white'
                e.currentTarget.style.borderLeft = '2px solid white'
                e.currentTarget.style.borderRight = '2px solid #404040'
                e.currentTarget.style.borderBottom = '2px solid #404040'
              }}
            >
              {label}
            </button>
          ))}
        </div>

      </div>

      <style>{`
        @keyframes winPop {
          from { transform: scale(0.88); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes sWave {
          from { opacity: 0.25; }
          to   { opacity: 1;    }
        }
      `}</style>
    </div>
  )
}