// supabase/functions/send-reply-email/index.ts
//
// 部署方法：
//   supabase functions deploy send-reply-email
//
// 需要在 Supabase Dashboard → Edge Functions → Secrets 里设置：
//   RESEND_API_KEY=re_xxxxxxxxxxxx
//   SITE_FROM_EMAIL=noreply@yourdomain.com   （必须是 Resend 已验证的域名）
//   SITE_NAME=Bareerah 的小屋
//   SITE_URL=https://bareerahsite.dpdns.org

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // 处理 CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const FROM_EMAIL    = Deno.env.get('SITE_FROM_EMAIL')
    const SITE_NAME     = Deno.env.get('SITE_NAME')
    const SITE_URL      = Deno.env.get('SITE_URL')

    if (!RESEND_API_KEY) {
      throw new Error('缺少环境变量 RESEND_API_KEY，请在 Supabase Dashboard 中配置')
    }

    const { to, name, originalMessage, reply } = await req.json()

    if (!to || !name || !originalMessage || !reply) {
      throw new Error('请求体缺少必要字段：to / name / originalMessage / reply')
    }

    // 构建 HTML 邮件正文（BBS 复古风）
    const html = `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: 'Courier New', monospace; background: #c0c0c0; margin: 0; padding: 20px; }
    .card { background: white; border: 4px solid #808080; box-shadow: 4px 4px 0 #000; max-width: 600px; margin: 0 auto; }
    .header { background: #000080; color: white; padding: 16px 20px; }
    .header h1 { margin: 0; font-size: 18px; letter-spacing: 2px; }
    .header p { margin: 4px 0 0; font-size: 11px; opacity: 0.8; }
    .body { padding: 24px; }
    .greeting { font-size: 15px; margin-bottom: 16px; }
    .label { font-size: 11px; font-weight: bold; color: #000080; margin-bottom: 4px; }
    .original { background: #f8f4e8; border-left: 4px solid #808080; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #555; }
    .reply-box { background: #eef2ff; border-left: 4px solid #000080; padding: 12px; margin-bottom: 20px; font-size: 14px; }
    .cta { text-align: center; margin: 20px 0; }
    .cta a { display: inline-block; background: #000080; color: white; padding: 10px 24px; text-decoration: none; font-weight: bold; border: 2px solid #000; box-shadow: 2px 2px 0 #000; }
    .footer { font-size: 10px; color: #999; border-top: 2px solid #c0c0c0; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>📋 ${SITE_NAME}</h1>
      <p>Message Board / 留言板回复通知</p>
    </div>
    <div class="body">
      <p class="greeting">您好，<strong>${name}</strong>！</p>
      <p>站长回复了您在留言板的留言：</p>

      <div class="label">您的原始留言：</div>
      <div class="original">${originalMessage.replace(/\n/g, '<br/>')}</div>

      <div class="label">站长回复：</div>
      <div class="reply-box">${reply.replace(/\n/g, '<br/>')}</div>

      <div class="cta">
        <a href="${SITE_URL}">前往留言板查看 →</a>
      </div>

      <div class="footer">
        此邮件由 ${SITE_NAME} 自动发送，请勿直接回复本邮件。<br/>
        如有疑问，请访问 ${SITE_URL}
      </div>
    </div>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${SITE_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject: `${SITE_NAME} 回复了您的留言`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Resend 发送失败：${err}`)
    }

    const data = await res.json()
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('send-reply-email error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
