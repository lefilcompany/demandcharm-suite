import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adjustDueDateToBusinessDay,
  calculateBusinessDueDate,
  calculateNextRunDate,
  isAuthorized,
  isValidFrequency,
} from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!isAuthorized(authHeader, cronSecret)) {
      const prefix = authHeader ? authHeader.slice(0, 10) : "<missing>";
      console.warn("Unauthorized cron invocation", {
        hasSecret: !!cronSecret,
        headerPrefix: prefix,
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    console.log("Processing recurring demands for date:", today);

    const { data: recurringDemands, error: fetchError } = await supabase
      .from("recurring_demands")
      .select("*, services:service_id(estimated_hours)")
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      throw fetchError;
    }

    console.log("Found recurring demands:", recurringDemands?.length || 0);

    if (!recurringDemands || recurringDemands.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recurring demands to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    for (const rd of recurringDemands) {
      try {
        if (rd.end_date && rd.end_date < today) {
          await supabase
            .from("recurring_demands")
            .update({ is_active: false })
            .eq("id", rd.id);
          continue;
        }

        if (!isValidFrequency(rd.frequency)) {
          console.warn(`Skipping recurring demand ${rd.id}: invalid frequency "${rd.frequency}"`);
          skipped++;
          continue;
        }

        if (rd.last_generated_at) {
          const lastGenDate = rd.last_generated_at.split("T")[0];
          if (lastGenDate === today) {
            console.log(`Skipping recurring demand ${rd.id}: already generated today`);
            skipped++;
            continue;
          }
        }

        const estimatedHours = rd.services?.estimated_hours;
        const dueDate = estimatedHours
          ? calculateBusinessDueDate(rd.next_run_date, estimatedHours)
          : adjustDueDateToBusinessDay(rd.next_run_date);

        const { data: newDemand, error: createError } = await supabase
          .from("demands")
          .insert({
            title: rd.title,
            description: rd.description,
            priority: rd.priority,
            status_id: rd.status_id,
            service_id: rd.service_id,
            board_id: rd.board_id,
            team_id: rd.team_id,
            created_by: rd.created_by,
            due_date: dueDate,
            recurring_demand_id: rd.id,
          })
          .select("id")
          .single();

        if (createError) {
          console.error(`Error creating demand for recurring ${rd.id}:`, createError);
          errors++;
          continue;
        }

        if (rd.assignee_ids && rd.assignee_ids.length > 0 && newDemand) {
          const assigneeInserts = rd.assignee_ids.map((userId: string) => ({
            demand_id: newDemand.id,
            user_id: userId,
          }));
          const { error: assignError } = await supabase.from("demand_assignees").insert(assigneeInserts);
          if (assignError) {
            console.error(`Error adding assignees for recurring demand ${rd.id}:`, assignError);
          }
        }

        let nextDate = calculateNextRunDate(
          rd.frequency,
          rd.next_run_date,
          rd.weekdays,
          rd.day_of_month,
        );

        while (nextDate <= today) {
          nextDate = calculateNextRunDate(
            rd.frequency,
            nextDate,
            rd.weekdays,
            rd.day_of_month,
          );
        }

        const isStillActive = !rd.end_date || nextDate <= rd.end_date;

        await supabase
          .from("recurring_demands")
          .update({
            last_generated_at: new Date().toISOString(),
            next_run_date: nextDate,
            is_active: isStillActive,
          })
          .eq("id", rd.id);

        processed++;
      } catch (err) {
        console.error(`Error processing recurring demand ${rd.id}:`, err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ message: "Processing complete", processed, errors, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in process-recurring-demands:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

// Auto-start the server when this module is loaded by the Supabase edge runtime.
// Tests import { handler } from this file without starting the server because
// `Deno.serve` is invoked lazily here, and the test runner sets
// `SKIP_SERVE=1` so we don't bind a port during `deno test`.
if (!Deno.env.get("SKIP_SERVE")) {
  Deno.serve(handler);
}
