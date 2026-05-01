/**
 * Shared playlist types — safe to import from both server and client. The
 * filesystem-backed store in [lib/playlist-store.ts](lib/playlist-store.ts)
 * is server-only; importing it from a client component pulls `fs`/`crypto`
 * into the browser bundle. So the wire-shape types live here.
 */

export interface PlaylistSong {
  songId: string;
  songName: string;
  singer: string;
  singerPic: string;
  isCloud: boolean;
}

export interface PlaylistMeta {
  id: string;
  name: string;
  songCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  songs: PlaylistSong[];
}
