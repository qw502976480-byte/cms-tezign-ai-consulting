import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const id = ctx?.params?.id;

  if (!id) {
    return new NextResponse("Missing id", { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from("demo_request_logs")
      .select(
        "created_at, actor, action, prev_outcome, new_outcome, prev_status, new_status"
      )
      .eq("demo_request_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET logs] supabase error:", error);
      return new NextResponse(
        `Failed to load logs: ${error.message}`,
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (e: any) {
    console.error("[GET logs] unexpected error:", e);
    return new NextResponse(
      `Unexpected error: ${e?.message ?? String(e)}`,
      { status: 500 }
    );
  }
}
