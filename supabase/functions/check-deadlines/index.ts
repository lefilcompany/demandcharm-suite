import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserPreferences {
  deadlineReminders?: boolean;
  pushNotifications?: boolean;
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const requestTimestamp = new Date().toISOString();
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET for authentication
    const authHeader = req.headers.get("authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    
    if (!cronSecret) {
      console.error(`[${requestId}] [${requestTimestamp}] CRON_SECRET not configured - server misconfiguration`);
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if request has valid authorization
    const expectedAuth = `Bearer ${cronSecret}`;
    if (authHeader !== expectedAuth) {
      // Enhanced security logging for failed auth attempts
      const clientIP = req.headers.get("x-forwarded-for") || 
                       req.headers.get("cf-connecting-ip") || 
                       req.headers.get("x-real-ip") || 
                       "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      
      console.warn(`[${requestId}] [${requestTimestamp}] SECURITY: Unauthorized access attempt to check-deadlines | IP: ${clientIP} | User-Agent: ${userAgent}`);
      
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${requestId}] [${requestTimestamp}] Starting authorized deadline check...`);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time and 24 hours from now
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    console.log(`Checking deadlines. Current time: ${now.toISOString()}`);

    // === PART 1: Find demands with APPROACHING deadlines (within 24 hours) ===
    const { data: approachingDemands, error: approachingError } = await supabase
      .from("demands")
      .select(`
        id,
        title,
        due_date,
        created_by,
        assigned_to,
        team_id,
        demand_statuses!inner(name)
      `)
      .gte("due_date", now.toISOString())
      .lte("due_date", tomorrow.toISOString())
      .eq("archived", false)
      .neq("demand_statuses.name", "Entregue");

    if (approachingError) {
      console.error("Error fetching approaching demands:", approachingError);
      throw approachingError;
    }

    console.log(`Found ${approachingDemands?.length || 0} demands with approaching deadlines`);

    // === PART 2: Find demands with OVERDUE deadlines (past due) ===
    const { data: overdueDemands, error: overdueError } = await supabase
      .from("demands")
      .select(`
        id,
        title,
        due_date,
        created_by,
        assigned_to,
        team_id,
        demand_statuses!inner(name)
      `)
      .lt("due_date", now.toISOString())
      .eq("archived", false)
      .neq("demand_statuses.name", "Entregue");

    if (overdueError) {
      console.error("Error fetching overdue demands:", overdueError);
      throw overdueError;
    }

    console.log(`Found ${overdueDemands?.length || 0} overdue demands`);

    // Check existing notifications to avoid duplicates (sent in last 12 hours for approaching, 24 hours for overdue)
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const notificationsToCreate: Array<{
      user_id: string;
      title: string;
      message: string;
      type: string;
      link: string;
    }> = [];

    const pushNotificationsToSend: Array<{
      user_id: string;
      title: string;
      body: string;
      link: string;
      hoursRemaining: number;
      isOverdue: boolean;
      demandId: string;
    }> = [];

    // Get all assignees for all demands
    const allDemandIds = [
      ...(approachingDemands || []).map(d => d.id),
      ...(overdueDemands || []).map(d => d.id)
    ];

    const { data: allAssignees } = await supabase
      .from("demand_assignees")
      .select("demand_id, user_id")
      .in("demand_id", allDemandIds);

    const assigneeMap = new Map<string, string[]>();
    for (const assignee of allAssignees || []) {
      const existing = assigneeMap.get(assignee.demand_id) || [];
      existing.push(assignee.user_id);
      assigneeMap.set(assignee.demand_id, existing);
    }

    // Process APPROACHING demands
    for (const demand of approachingDemands || []) {
      const dueDate = new Date(demand.due_date);
      const hoursUntilDeadline = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      
      // Get users to notify (creator, assigned_to, and all assignees)
      const usersToNotify = new Set<string>();
      if (demand.created_by) usersToNotify.add(demand.created_by);
      if (demand.assigned_to) usersToNotify.add(demand.assigned_to);
      const demandAssignees = assigneeMap.get(demand.id) || [];
      for (const assigneeId of demandAssignees) {
        usersToNotify.add(assigneeId);
      }

      for (const userId of usersToNotify) {
        // Check if we already sent a deadline notification for this demand recently
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("link", `/demands/${demand.id}`)
          .like("title", "%Prazo%")
          .gte("created_at", twelveHoursAgo.toISOString())
          .maybeSingle();

        if (!existingNotification) {
          const notifTitle = hoursUntilDeadline <= 2 ? "⚠️ Prazo urgente!" : "⏰ Prazo se aproximando";
          const notifMessage = `A demanda "${demand.title}" vence em ${hoursUntilDeadline} hora${hoursUntilDeadline !== 1 ? "s" : ""}`;
          
          notificationsToCreate.push({
            user_id: userId,
            title: notifTitle,
            message: notifMessage,
            type: hoursUntilDeadline <= 2 ? "warning" : "info",
            link: `/demands/${demand.id}`,
          });

          pushNotificationsToSend.push({
            user_id: userId,
            title: notifTitle,
            body: notifMessage,
            link: `/demands/${demand.id}`,
            hoursRemaining: hoursUntilDeadline,
            isOverdue: false,
            demandId: demand.id,
          });
        }
      }
    }

    // Process OVERDUE demands
    for (const demand of overdueDemands || []) {
      const dueDate = new Date(demand.due_date);
      const hoursOverdue = Math.round((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60));
      
      // Get users to notify
      const usersToNotify = new Set<string>();
      if (demand.created_by) usersToNotify.add(demand.created_by);
      if (demand.assigned_to) usersToNotify.add(demand.assigned_to);
      const demandAssignees = assigneeMap.get(demand.id) || [];
      for (const assigneeId of demandAssignees) {
        usersToNotify.add(assigneeId);
      }

      for (const userId of usersToNotify) {
        // Check if we already sent an overdue notification for this demand recently (24h window)
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("link", `/demands/${demand.id}`)
          .like("title", "%vencido%")
          .gte("created_at", twentyFourHoursAgo.toISOString())
          .maybeSingle();

        if (!existingNotification) {
          const notifTitle = "🚨 Prazo vencido!";
          const notifMessage = `A demanda "${demand.title}" está com prazo vencido há ${hoursOverdue} hora${hoursOverdue !== 1 ? "s" : ""}`;
          
          notificationsToCreate.push({
            user_id: userId,
            title: notifTitle,
            message: notifMessage,
            type: "error",
            link: `/demands/${demand.id}`,
          });

          pushNotificationsToSend.push({
            user_id: userId,
            title: notifTitle,
            body: notifMessage,
            link: `/demands/${demand.id}`,
            hoursRemaining: -hoursOverdue,
            isOverdue: true,
            demandId: demand.id,
          });
        }
      }
    }

    console.log(`Creating ${notificationsToCreate.length} in-app notifications`);
    console.log(`Sending ${pushNotificationsToSend.length} push notifications`);

    // Insert in-app notifications
    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notificationsToCreate);

      if (insertError) {
        console.error("Error inserting notifications:", insertError);
        throw insertError;
      }
    }

    // Get user preferences for push notifications
    const uniqueUserIds = [...new Set(pushNotificationsToSend.map(p => p.user_id))];
    
    const { data: notifPreferences } = await supabase
      .from("user_preferences")
      .select("user_id, preference_value")
      .eq("preference_key", "notification_preferences")
      .in("user_id", uniqueUserIds);

    const userPrefsMap = new Map<string, UserPreferences>();
    for (const pref of notifPreferences || []) {
      userPrefsMap.set(pref.user_id, pref.preference_value as UserPreferences);
    }

    // Group push notifications by user
    const pushByUser = new Map<string, typeof pushNotificationsToSend>();
    for (const push of pushNotificationsToSend) {
      const existing = pushByUser.get(push.user_id) || [];
      existing.push(push);
      pushByUser.set(push.user_id, existing);
    }

    // Send push notifications respecting user preferences
    let pushSentCount = 0;
    let pushSkippedCount = 0;

    for (const [userId, pushes] of pushByUser) {
      const userPrefs = userPrefsMap.get(userId);
      
      // Check if user has deadline reminders enabled
      if (userPrefs?.deadlineReminders === false || userPrefs?.pushNotifications === false) {
        console.log(`User ${userId} has deadline reminders or push disabled, skipping ${pushes.length} notifications`);
        pushSkippedCount += pushes.length;
        continue;
      }

      // Send via send-push-notification function
      for (const push of pushes) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              userIds: [push.user_id],
              title: push.title,
              body: push.body,
              link: push.link,
              data: {
                notificationType: "deadlineReminders",
                type: push.isOverdue ? "deadline_overdue" : "deadline_approaching",
                demandId: push.demandId,
              },
            }),
          });

          if (response.ok) {
            pushSentCount++;
          } else {
            console.error(`Failed to send push to user ${userId}:`, await response.text());
          }
        } catch (pushError) {
          console.error(`Error sending push to user ${userId}:`, pushError);
        }
      }
    }

    console.log(`Deadline check completed. Push sent: ${pushSentCount}, skipped: ${pushSkippedCount}`);

    return new Response(
      JSON.stringify({ 
        message: "Deadline check completed", 
        approachingDemandsChecked: approachingDemands?.length || 0,
        overdueDemandsChecked: overdueDemands?.length || 0,
        notificationsSent: notificationsToCreate.length,
        pushNotificationsSent: pushSentCount,
        pushNotificationsSkipped: pushSkippedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-deadlines function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
