/**
 * Cloudflare Worker Backend for Receipt App
 * Handles CORS, Google Sheets API Integration, Receipt Logging,
 * User Authentication, and Fallback Admin Login.
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
      const gasWebhookUrl = env.GOOGLE_SHEETS_WEBHOOK || 'https://script.google.com/macros/s/AKfycbwYhD8P2zH2q7nQ-aI3951FfT1HnC0O2b0sM3u_n1p/exec';

      if (request.method === 'POST') {
        const rawText = await request.text();
        let body = {};
        try {
          body = JSON.parse(rawText);
        } catch (e) {
          body = { raw: rawText };
        }
        
        if (body.action === 'login') {
           const reqEmail = String(body.email || '').toLowerCase().trim();
           const reqPassword = String(body.password || '').trim();

           // 1. Forward login request directly to Google Apps Script doPost (handleLogin)
           if (gasWebhookUrl) {
              try {
                 const res = await fetch(gasWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'login', email: reqEmail, password: reqPassword })
                 });
                 const dataText = await res.text();
                 const dataJson = JSON.parse(dataText);
                 if (dataJson && (dataJson.status === 'success' || dataJson.status === 'error')) {
                    return new Response(JSON.stringify(dataJson), {
                       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                 }
              } catch (e) {
                 console.warn('GAS POST login failed:', e.message);
              }
           }

           // 2. Default Admin Fallbacks (Emergency backup if GAS is unreachable)
           const defaultAdmins = [
              {
                 firstName: 'อรรถเดช',
                 lastName: 'ศรีสุข',
                 fullName: 'อรรถเดช ศรีสุข',
                 role: 'Admin',
                 email: 'aukkdach.beem@gmail.com',
                 status: 'Approved',
                 rawPassword: '3321'
              },
              {
                 firstName: 'อรรถเดช',
                 lastName: 'ศรีสุข',
                 fullName: 'อรรถเดช ศรีสุข',
                 role: 'Admin',
                 email: 'beemcr73327@gmail.com',
                 status: 'Approved',
                 rawPassword: '3321'
              }
           ];

           const adminUser = defaultAdmins.find(a => a.email.toLowerCase() === reqEmail);
           if (adminUser) {
              const expectedPassword = String(adminUser.rawPassword || '').trim();
              if (!expectedPassword || expectedPassword === reqPassword) {
                 const safeUser = { ...adminUser };
                 delete safeUser.rawPassword;
                 return new Response(JSON.stringify({ status: 'success', user: safeUser }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              } else {
                 return new Response(JSON.stringify({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }
           }

           return new Response(JSON.stringify({ status: 'error', message: 'ไม่พบอีเมลนี้ในระบบ' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        let gasResponseText = '';
        if (gasWebhookUrl) {
          try {
             const res = await fetch(gasWebhookUrl, {
               method: 'POST',
               headers: { 'Content-Type': 'text/plain;charset=utf-8' },
               body: rawText
             });
             gasResponseText = await res.text();
          } catch(e) {}
        }

        return new Response(gasResponseText || JSON.stringify({
          success: true,
          message: 'Request processed successfully!'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'GET') {
         let resultData = {
            status: 'success',
            suppliers: [],
            tops: [],
            payments: ['เงินโอน', 'เช็ค', 'เงินสด'],
            banks: ['SCB SA 1234', 'KBANK 5678'],
            users: [
               {
                  firstName: 'อรรถเดช',
                  lastName: 'ศรีสุข',
                  fullName: 'อรรถเดช ศรีสุข',
                  role: 'Admin',
                  email: 'aukkdach.beem@gmail.com',
                  status: 'Approved'
               },
               {
                  firstName: 'อรรถเดช',
                  lastName: 'ศรีสุข',
                  fullName: 'อรรถเดช ศรีสุข',
                  role: 'Admin',
                  email: 'beemcr73327@gmail.com',
                  status: 'Approved'
               }
            ],
            receipts: []
         };

         if (gasWebhookUrl) {
            try {
               const res = await fetch(gasWebhookUrl, {
                  method: 'GET',
                  redirect: 'follow'
               });
               const dataText = await res.text();
               const dataJson = JSON.parse(dataText);
               if (dataJson && dataJson.status === 'success') {
                  resultData = dataJson;
               }
            } catch(e) {}
         }

         return new Response(JSON.stringify(resultData), {
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
