import { redirect } from 'next/navigation';

export default function LegacyContentPage() {
  redirect('/admin/resources');
}