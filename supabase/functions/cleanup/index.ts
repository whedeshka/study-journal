import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${Deno.env.get("CRON_SECRET")}`) return new Response("Unauthorized", {status:401});
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const {data: expired, error} = await supabase.from("tasks").select("id").lte("expires_at", new Date().toISOString());
  if (error) return Response.json({error:error.message},{status:500});
  let removed=0;
  for (const task of expired || []) {
    const {data: files, error: fe} = await supabase.from("attachments").select("storage_path").eq("task_id",task.id);
    if (fe) return Response.json({error:fe.message},{status:500});
    const paths=(files||[]).map(x=>x.storage_path);
    if(paths.length){
      const {error:se}=await supabase.storage.from("homework-files").remove(paths);
      if(se) return Response.json({error:se.message,task_id:task.id},{status:500});
    }
    const {error:de}=await supabase.from("tasks").delete().eq("id",task.id);
    if(de) return Response.json({error:de.message},{status:500});
    removed++;
  }
  return Response.json({ok:true,removed});
});