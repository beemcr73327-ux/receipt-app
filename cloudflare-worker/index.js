/**
 * Cloudflare Worker Backend for Receipt App
 * Handles CORS, Google Sheets API Integration, Receipt Logging,
 * and Auto-Increment Receipt Number Generation (REV YYMMXXXX).
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method === 'POST') {
        const rawText = await request.text();
        let body = {};
        try {
          body = JSON.parse(rawText);
        } catch (e) {
          body = { raw: rawText };
        }
        
        if (body.action === 'login') {
           if (env.USERS_KV) {
              let internalConfig = await env.USERS_KV.get('config_cache_internal', 'json');
              if (!internalConfig && env.GOOGLE_SHEETS_WEBHOOK) {
                 // Fetch from GAS if cache miss
                 const res = await fetch(env.GOOGLE_SHEETS_WEBHOOK, { method: 'GET', redirect: 'follow' });
                 const dataText = await res.text();
                 try {
                    internalConfig = JSON.parse(dataText);
                    ctx.waitUntil(env.USERS_KV.put('config_cache_internal', dataText, { expirationTtl: 300 }));
                 } catch (e) {}
              }
              
              if (internalConfig && internalConfig.users) {
                 const user = internalConfig.users.find(u => u.email === body.email);
                 if (user) {
                    if (user.status !== 'Approved') {
                       return new Response(JSON.stringify({ status: 'error', message: 'รอการอนุมัติจาก Admin' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                    }
                    if (user.rawPassword === body.password) {
                       const safeUser = { ...user };
                       delete safeUser.rawPassword;
                       return new Response(JSON.stringify({ status: 'success', user: safeUser }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                    } else {
                       return new Response(JSON.stringify({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                    }
                 } else {
                    return new Response(JSON.stringify({ status: 'error', message: 'ไม่พบอีเมลนี้ในระบบ' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                 }
              }
              return new Response(JSON.stringify({ status: 'error', message: 'ระบบกำลังเตรียมข้อมูล กรุณาลองใหม่' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           }
        }
        
        let gasResponseText = '';
        if (env.GOOGLE_SHEETS_WEBHOOK) {
          const res = await fetch(env.GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: rawText
          });
          gasResponseText = await res.text();
        }

        // If it was a user registration or update, invalidate the KV cache for users
        if (body.action === 'registerUser' || body.action === 'updateUserStatus') {
           if (env.USERS_KV) {
              await env.USERS_KV.delete('config_cache_public');
              await env.USERS_KV.delete('config_cache_internal');
           }
        }

        return new Response(gasResponseText || JSON.stringify({
          success: true,
          message: 'Request forwarded to Google Sheets successfully!'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'GET') {
         // Check KV cache first
         if (env.USERS_KV) {
            const cachedConfig = await env.USERS_KV.get('config_cache_public');
            if (cachedConfig) {
               return new Response(cachedConfig, {
                 headers: { ...corsHeaders, 'Content-Type': 'application/json' }
               });
            }
         }

         // Fetch from GAS
         if (env.GOOGLE_SHEETS_WEBHOOK) {
            const res = await fetch(env.GOOGLE_SHEETS_WEBHOOK, {
               method: 'GET',
               redirect: 'follow'
            });
            const dataText = await res.text();
            
            let dataJson = {};
            try { dataJson = JSON.parse(dataText); } catch(e) {}
            
            if (dataJson && dataJson.users) {
               // Save full data with passwords to internal cache
               if (env.USERS_KV) {
                  ctx.waitUntil(env.USERS_KV.put('config_cache_internal', dataText, { expirationTtl: 300 }));
               }
               // Strip passwords for public cache
               const publicUsers = dataJson.users.map(u => {
                 const safeUser = { ...u };
                 delete safeUser.rawPassword;
                 return safeUser;
               });
               dataJson.users = publicUsers;
               const publicDataText = JSON.stringify(dataJson);
               
               if (env.USERS_KV) {
                  ctx.waitUntil(env.USERS_KV.put('config_cache_public', publicDataText, { expirationTtl: 300 }));
               }

               return new Response(publicDataText, {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
               });
            }

            return new Response(dataText, {
               headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
         }

         return new Response(JSON.stringify({
            status: 'error',
            message: 'GOOGLE_SHEETS_WEBHOOK not set'
         }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
