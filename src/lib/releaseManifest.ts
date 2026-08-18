/**
 * Release Manifest contract — frontend entry point.
 *
 * The canonical implementation lives in
 * `supabase/functions/_shared/releaseManifest.ts` so that edge functions and
 * the frontend share exactly one validator. Do not duplicate the rules here.
 */
export * from "../../supabase/functions/_shared/releaseManifest";
