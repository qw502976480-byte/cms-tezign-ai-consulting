import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params?.id;

  if (!id) {
    return new NextResponse("Missing id", { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("demo_request_logs")
    .select(
      "id, demo_request_id, action, prev_outcome, new_outcome, prev_status, new_status, actor, created_at"
    )
    .eq("demo_request_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[logs] supabase error:", error);
    return new NextResponse(`Failed to load logs: ${error.message}`, {
      status: 500,
    });
  }

  return NextResponse.json(data ?? []);
}
