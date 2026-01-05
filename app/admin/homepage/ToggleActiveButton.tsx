'use client';
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ToggleActiveButton({ type, isActive }: { type: string; isActive: boolean }) {
  const supabase = createClient();
  const router = useRouter();

  const handleToggle = async () => {
    await supabase
      .from('homepage_config')
      .update({ is_active: !isActive })
      .eq('type', type);
    router.refresh();
  };
  
  return (
    <button
      onClick={handleToggle}
      className={`text-xs font-medium px-3 py-1 rounded-full transition ${
        isActive
          ? 'bg-gray-900 text-white hover:bg-black'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {isActive ? '已启用' : '已禁用'}
    </button>
  );
}