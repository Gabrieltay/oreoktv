import { PlaylistDetail } from "@/components/playlist-detail";

export default function PlaylistDetailPage({ params }: { params: { id: string } }) {
  return (
    <section className="flex-1">
      <PlaylistDetail id={params.id} />
    </section>
  );
}
