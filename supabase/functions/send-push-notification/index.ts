import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
}

interface UserPreferences {
  pushNotifications?: boolean;
  demandUpdates?: boolean;
  teamUpdates?: boolean;
  deadlineReminders?: boolean;
  adjustmentRequests?: boolean;
  mentionNotifications?: boolean;
}

// Get access token for FCM HTTP v1 API
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // Token expires in 1 hour

  // Create JWT header
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  // Create JWT payload
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: exp,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the JWT
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Send push notification via FCM HTTP v1 API
async function sendPushNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; error?: string; shouldRemoveToken?: boolean }> {
  const message = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      webpush: {
        notification: {
          icon: "/favicon.png",
          badge: "/favicon.png",
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: data?.type || "soma-notification",
        },
        fcm_options: {
          link: data?.link || "/",
        },
      },
      data: data || {},
    },
  };

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("FCM send error:", errorText);
      
      // Check if token is invalid/expired
      if (errorText.includes("UNREGISTERED") || errorText.includes("INVALID_ARGUMENT")) {
        return { success: false, error: errorText, shouldRemoveToken: true };
      }
      
      return { success: false, error: errorText };
    }

    console.log("Push notification sent successfully to token:", fcmToken.substring(0, 20) + "...");
    return { success: true };
  } catch (error: any) {
    console.error("FCM request error:", error);
    return { success: false, error: error.message };
  }
}

// Check if user has enabled the specific notification type
function shouldSendNotification(
  preferences: UserPreferences | null,
  notificationType: string
): boolean {
  // If no preferences found, default to sending
  if (!preferences) return true;
  
  // Check if push notifications are globally enabled
  if (preferences.pushNotifications === false) {
    console.log("Push notifications globally disabled for user");
    return false;
  }

  // Check specific notification type
  switch (notificationType) {
    case "demandUpdates":
      return preferences.demandUpdates !== false;
    case "teamUpdates":
      return preferences.teamUpdates !== false;
    case "deadlineReminders":
      return preferences.deadlineReminders !== false;
    case "adjustmentRequests":
      return preferences.adjustmentRequests !== false;
    case "mentionNotifications":
      return preferences.mentionNotifications !== false;
    default:
      return true;
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication: either a valid user JWT, CRON_SECRET, or the Vault-managed CRON_TOKEN for server-to-server calls
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const cronToken = Deno.env.get("CRON_TOKEN");
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    const isCronCall = !!bearer && ((!!cronSecret && bearer === cronSecret) || (!!cronToken && bearer === cronToken));

    let callerUserId: string | null = null;
    if (!isCronCall) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerUserId = userData.user.id;
    }

    // Parse service account from environment
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const projectId = serviceAccount.project_id;

    // Get access token
    console.log("Getting FCM access token...");
    const accessToken = await getAccessToken(serviceAccount);

    // Parse request
    const { userId, userIds, title, body, link, data }: PushNotificationRequest = await req.json();
    const notificationType = data?.notificationType || "demandUpdates";

    console.log(`Processing push notification: "${title}" for notification type: ${notificationType}`);

    if (!title || !body) {
      throw new Error("title and body are required");
    }

    // Combine single userId and userIds array
    const targetUserIds: string[] = [];
    if (userId) targetUserIds.push(userId);
    if (userIds) targetUserIds.push(...userIds);

    // Remove duplicates
    const uniqueUserIds = [...new Set(targetUserIds)];

    if (uniqueUserIds.length === 0) {
      throw new Error("userId or userIds is required");
    }

    console.log(`Target users: ${uniqueUserIds.length}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authorization: when called by a real user, only allow targets that share a team with the caller
    let allowedUserIds = uniqueUserIds;
    if (!isCronCall && callerUserId) {
      const { data: callerTeams } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", callerUserId);
      const callerTeamIds = (callerTeams || []).map((r: { team_id: string }) => r.team_id);

      if (callerTeamIds.length === 0) {
        allowedUserIds = uniqueUserIds.filter((id) => id === callerUserId);
      } else {
        const { data: sharedMembers } = await supabase
          .from("team_members")
          .select("user_id")
          .in("team_id", callerTeamIds)
          .in("user_id", allowedUserIds);
        const sharedSet = new Set((sharedMembers || []).map((r: { user_id: string }) => r.user_id));
        sharedSet.add(callerUserId);
        allowedUserIds = uniqueUserIds.filter((id) => sharedSet.has(id));
      }

      const blocked = uniqueUserIds.length - allowedUserIds.length;
      if (blocked > 0) {
        console.warn(`Blocked ${blocked} push targets not sharing a team with caller ${callerUserId}`);
      }
      if (allowedUserIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, sent: 0, failed: 0, skipped: 0, blocked }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get FCM tokens and notification preferences for all target users
    const { data: fcmPreferences, error: fcmError } = await supabase
      .from("user_preferences")
      .select("user_id, preference_value")
      .eq("preference_key", "fcm_token")
      .in("user_id", allowedUserIds);

    if (fcmError) {
      console.error("Error fetching FCM tokens:", fcmError);
      throw fcmError;
    }

    // Get notification preferences
    const { data: notifPreferences, error: notifError } = await supabase
      .from("user_preferences")
      .select("user_id, preference_value")
      .eq("preference_key", "notification_preferences")
      .in("user_id", allowedUserIds);

    if (notifError) {
      console.error("Error fetching notification preferences:", notifError);
      // Continue anyway - we'll use defaults
    }

    // Build a map of user preferences
    const userPrefsMap = new Map<string, UserPreferences>();
    for (const pref of notifPreferences || []) {
      userPrefsMap.set(pref.user_id, pref.preference_value as UserPreferences);
    }

    const notificationData = {
      ...data,
      link: link || "/",
    };

    // Send push notifications
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const tokensToRemove: { userId: string; token: string }[] = [];

    for (const pref of fcmPreferences || []) {
      const prefValue = pref.preference_value as { token?: string };
      const fcmToken = prefValue?.token;

      if (!fcmToken) {
        console.log(`No FCM token for user ${pref.user_id}`);
        continue;
      }

      // Check user preferences
      const userPrefs = userPrefsMap.get(pref.user_id);
      if (!shouldSendNotification(userPrefs || null, notificationType)) {
        console.log(`User ${pref.user_id} has disabled ${notificationType} notifications`);
        skippedCount++;
        continue;
      }

      const result = await sendPushNotification(
        accessToken,
        projectId,
        fcmToken,
        title,
        body,
        notificationData
      );

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        if (result.shouldRemoveToken) {
          tokensToRemove.push({ userId: pref.user_id, token: fcmToken });
        }
      }
    }

    // Remove invalid tokens
    if (tokensToRemove.length > 0) {
      console.log(`Removing ${tokensToRemove.length} invalid FCM tokens...`);
      for (const { userId } of tokensToRemove) {
        await supabase
          .from("user_preferences")
          .delete()
          .eq("user_id", userId)
          .eq("preference_key", "fcm_token");
      }
    }

    console.log(`Push notifications complete: ${successCount} sent, ${failCount} failed, ${skippedCount} skipped (preferences)`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        skipped: skippedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
