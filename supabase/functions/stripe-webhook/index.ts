import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET is not configured");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified");
    } catch (err) {
      logStep("ERROR: Webhook signature verification failed", { error: String(err) });
      return new Response(
        JSON.stringify({ error: "Webhook signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Received event", { type: event.type });

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { teamId, planId } = session.metadata || {};

        if (!teamId || !planId) {
          logStep("ERROR: Missing metadata in checkout session", { metadata: session.metadata });
          break;
        }

        logStep("Processing checkout completion", { teamId, planId });

        const subscriptionId = session.subscription as string;
        if (!subscriptionId) {
          logStep("ERROR: No subscription ID in checkout session");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Check if subscription already exists
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("team_id", teamId)
          .maybeSingle();

        if (existingSub) {
          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              plan_id: planId,
              status: "active",
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: session.customer as string,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq("team_id", teamId);

          if (updateError) {
            logStep("ERROR: Failed to update subscription", { error: updateError });
          } else {
            logStep("Subscription updated successfully", { teamId });
          }
        } else {
          const { error: insertError } = await supabase.from("subscriptions").insert({
            team_id: teamId,
            plan_id: planId,
            status: "active",
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: session.customer as string,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });

          if (insertError) {
            logStep("ERROR: Failed to create subscription", { error: insertError });
          } else {
            logStep("Subscription created successfully", { teamId });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const teamId = subscription.metadata?.teamId;

        if (!teamId) {
          logStep("ERROR: No teamId in subscription metadata for invoice.payment_succeeded");
          break;
        }

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) {
          logStep("ERROR: Failed to update subscription after payment", { error });
        } else {
          logStep("Subscription renewed", { teamId });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) {
          logStep("ERROR: Failed to mark subscription as past_due", { error });
        } else {
          logStep("Subscription marked as past_due", { subscriptionId });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const teamId = subscription.metadata?.teamId;

        if (!teamId) {
          logStep("ERROR: No teamId in subscription metadata for deletion");
          break;
        }

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("ERROR: Failed to cancel subscription", { error });
        } else {
          logStep("Subscription canceled", { teamId });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const { error } = await supabase
          .from("subscriptions")
          .update({
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("ERROR: Failed to update subscription status", { error });
        } else {
          logStep("Subscription updated", { subscriptionId: subscription.id });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("FATAL ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
