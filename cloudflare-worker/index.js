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
      if (request.method === 'POST') {
        const rawText = await request.text();
        let body = {};
        try {
          body = JSON.parse(rawText);
        } catch (e) {
          body = { raw: rawText };
        }
        
        if (body.action === 'login') {
           let usersList = [];

           // 1. Try to fetch fresh user list from Google Sheets Webhook
           if (env.GOOGLE_SHEETS_WEBHOOK) {
              try {
                 const res = await fetch(env.GOOGLE_SHEETS_WEBHOOK, { method: 'GET', redirect: 'follow' });
                 const dataText = await res.text();
                 const dataJson = JSON.parse(dataText);
                 if (dataJson && dataJson.users && Array.isArray(dataJson.users)) {
                    usersList = dataJson.users;
                 }
              } catch (e) {
                 console.warn('GAS fetch failed:', e.message);
              }
           }

           // 2. Default Admin Fallbacks (Matches user's Admin emails)
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

           const reqEmail = String(body.email || '').toLowerCase().trim();
           const reqPassword = String(body.password || '').trim();

           let user = usersList.find(u => u && u.email && String(u.email).toLowerCase().trim() === reqEmail);
           
           // Fallback to default Admin if not found in fetched GAS list
           if (!user) {
              user = defaultAdmins.find(a => a.email.toLowerCase() === reqEmail);
           }

           if (user) {
              if (user.status === 'Blocked') {
                 return new Response(JSON.stringify({ status: 'error', message: 'บัญชีของคุณถูกระงับการใช้งาน' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }
              if (user.status === 'Pending') {
                 return new Response(JSON.stringify({ status: 'error', message: 'บัญชีอยู่ระหว่างรอการอนุมัติจาก Admin' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }

              const expectedPassword = String(user.rawPassword || '').trim();
              if (!expectedPassword || expectedPassword === reqPassword) {
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
        
        let gasResponseText = '';
        if (env.GOOGLE_SHEETS_WEBHOOK) {
          try {
             const res = await fetch(env.GOOGLE_SHEETS_WEBHOOK, {
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
            ]
         };

         if (env.GOOGLE_SHEETS_WEBHOOK) {
            try {
               const res = await fetch(env.GOOGLE_SHEETS_WEBHOOK, {
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
