// @ts-nocheck
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

// Initialize Resend & Supabase
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY");
const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// Simple HTML escape
function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const { record } = payload;

    if (!record || !record.sender_id || !record.conversation_id) {
      return new Response("Invalid payload", { status: 400 });
    }

    console.log(`Processing message ${record.id} from ${record.sender_id}`);

    // 1. Get conversation members
    const { data: members, error: membersError } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", record.conversation_id);

    if (membersError) throw membersError;

    const receiverIds = members
      .map((m: any) => m.user_id)
      .filter((id: string) => id !== record.sender_id);

    if (!receiverIds.length) {
      console.log("No receivers found.");
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // 2. Check presence
    const { data: presenceData, error: presenceError } = await supabase
      .from("user_presence")
      .select("user_id, is_online, last_seen")
      .in("user_id", receiverIds);

    if (presenceError) throw presenceError;

    const presenceMap = (presenceData || []).reduce((acc: any, p: any) => {
      acc[p.user_id] = p;
      return acc;
    }, {});

    // 3. Get sender info
    const { data: sender } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", record.sender_id)
      .single();

    const senderName = sender?.name || sender?.email || "Someone";

    // 4. Prepare emails
    const emailsToSend = [];

    for (const receiverId of receiverIds) {
      const presence = presenceMap[receiverId];
      const lastSeen = presence?.last_seen ? new Date(presence.last_seen) : null;
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const isZombie = presence?.is_online && (!lastSeen || lastSeen < twoMinutesAgo);
      const isOnline = presence?.is_online && !isZombie;

      if (!isOnline) {
        const { data: receiver } = await supabase
          .from("users")
          .select("email, name")
          .eq("id", receiverId)
          .single();

        if (receiver?.email) {
          const escapedContent = escapeHtml(record.content || "");
          emailsToSend.push({
            from: "Antigravity Chat <mail@bobthebuilder.tech>",
            to: [receiver.email],
            subject: `New message from ${senderName}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>New Message</h2>
                <p><strong>${senderName}</strong> sent you a message:</p>
                <blockquote style="border-left: 4px solid #ccc; padding-left: 10px; color: #555;">
                  ${escapedContent}
                </blockquote>
                <p>
                  <a href="${appUrl}/chat/${record.conversation_id}" style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    View Message
                  </a>
                </p>
              </div>
            `,
          });
          console.log(`Prepared email for ${receiver.email}`);
        }
      } else {
        console.log(`User ${receiverId} is online, skipping email.`);
      }
    }

    // 5. Send emails with per-email logging
    if (emailsToSend.length > 0) {
      await Promise.all(
        emailsToSend.map(async (email) => {
          try {
            const response = await resend.emails.send(email);
            console.log(`✅ Email sent to ${email.to}:`, response);
          } catch (err: any) {
            console.error(`❌ Failed to send email to ${email.to}:`, err.message || err);
          }
        })
      );
      console.log(`Attempted to send ${emailsToSend.length} emails.`);
    } else {
      console.log("No emails to send.");
    }

    return new Response(JSON.stringify({ sent: emailsToSend.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
