"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { PlaylistType } from "@/lib/types";

type PlaylistActionState = { error: string } | null;

type PlaylistSongInput = {
  playlistId: string;
  performanceVideoId: string;
  songIndex: number;
};

type PlaylistVideoInput = {
  playlistId: string;
  performanceVideoId: string;
};

type RemoveTrackInput = {
  playlistId: string;
  position: number;
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: data.user };
}

async function getOwnedPlaylist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playlistId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("playlists")
    .select("id, playlist_type")
    .eq("id", playlistId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw new Error("Could not verify playlist ownership.");
  return data;
}

async function getNextPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playlistId: string,
) {
  const { data, error } = await supabase
    .from("playlist_tracks")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data?.position ?? 0) + 1;
}

function getPlaylistName(formData: FormData) {
  const value = formData.get("name");
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return null;
  return name;
}

function getPlaylistType(formData: FormData): PlaylistType | null {
  const value = formData.get("type");
  return value === "videos" || value === "songs" ? value : null;
}

export async function createPlaylist(
  _previousState: PlaylistActionState,
  formData: FormData,
): Promise<PlaylistActionState> {
  const name = getPlaylistName(formData);
  const type = getPlaylistType(formData);
  if (!name) return { error: "Give your playlist a name up to 80 characters." };
  if (!type) return { error: "Choose whether this playlist is for songs or videos." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to create a playlist." };

  const ownerName =
    String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim() ||
    user.email?.split("@")[0] ||
    "You";
  const id = `playlist-${randomUUID()}`;
  const { error } = await supabase.from("playlists").insert({
    id,
    name,
    playlist_type: type,
    owner_id: user.id,
    owner_name: ownerName,
    visibility: "public",
  });

  if (error) return { error: "Could not create that playlist. Try again." };

  revalidatePath("/playlists");
  revalidatePath(`/playlist/${id}`);
  redirect(`/playlist/${id}`);
}

export async function deletePlaylist(playlistId: string): Promise<PlaylistActionState> {
  if (!playlistId) return { error: "Playlist not found." };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to delete a playlist." };
  if (!(await getOwnedPlaylist(supabase, playlistId, user.id))) {
    return { error: "You can only delete playlists you own." };
  }

  const { error } = await supabase.from("playlists").delete().eq("id", playlistId);
  if (error) return { error: "Could not delete that playlist. Try again." };

  revalidatePath("/playlists");
  revalidatePath(`/playlist/${playlistId}`);
  return null;
}

export async function addPlaylistSong(input: PlaylistSongInput): Promise<PlaylistActionState> {
  if (!input.playlistId || !input.performanceVideoId || !Number.isInteger(input.songIndex)) {
    return { error: "That song could not be added." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to add songs to a playlist." };
  const playlist = await getOwnedPlaylist(supabase, input.playlistId, user.id);
  if (!playlist) return { error: "You can only edit playlists you own." };
  if (playlist.playlist_type !== "songs") {
    return { error: "This is a video playlist. Create a song playlist for individual songs." };
  }

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("performance_video_id, song_index")
    .eq("performance_video_id", input.performanceVideoId)
    .eq("song_index", input.songIndex)
    .maybeSingle();
  if (songError || !song) return { error: "Song not found." };

  const { data: existing, error: existingError } = await supabase
    .from("playlist_tracks")
    .select("position")
    .eq("playlist_id", input.playlistId)
    .eq("performance_video_id", input.performanceVideoId)
    .eq("song_index", input.songIndex)
    .maybeSingle();
  if (existingError) return { error: "Could not check that playlist." };
  if (existing) return { error: "That song is already in this playlist." };

  const position = await getNextPosition(supabase, input.playlistId);
  if (!position) return { error: "Could not find the next playlist position." };

  const { error } = await supabase.from("playlist_tracks").insert({
    playlist_id: input.playlistId,
    position,
    performance_video_id: song.performance_video_id,
    song_index: song.song_index,
  });
  if (error) return { error: "Could not add that song. Try again." };

  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/playlists");
  return null;
}

export async function addPlaylistVideo(input: PlaylistVideoInput): Promise<PlaylistActionState> {
  if (!input.playlistId || !input.performanceVideoId) {
    return { error: "That video could not be added." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to add videos to a playlist." };
  const playlist = await getOwnedPlaylist(supabase, input.playlistId, user.id);
  if (!playlist) return { error: "You can only edit playlists you own." };
  if (playlist.playlist_type !== "videos") {
    return { error: "This is a song playlist. Create a video playlist for full performances." };
  }

  const { data: performance, error: performanceError } = await supabase
    .from("performances")
    .select("video_id")
    .eq("video_id", input.performanceVideoId)
    .maybeSingle();
  if (performanceError || !performance) return { error: "Video not found." };

  const { data: existing, error: existingError } = await supabase
    .from("playlist_tracks")
    .select("position")
    .eq("playlist_id", input.playlistId)
    .eq("performance_video_id", input.performanceVideoId)
    .is("song_index", null)
    .maybeSingle();
  if (existingError) return { error: "Could not check that playlist." };
  if (existing) return { error: "That video is already in this playlist." };

  const position = await getNextPosition(supabase, input.playlistId);
  if (!position) return { error: "Could not find the next playlist position." };

  const { error } = await supabase.from("playlist_tracks").insert({
    playlist_id: input.playlistId,
    position,
    performance_video_id: performance.video_id,
    song_index: null,
  });
  if (error) return { error: "Could not add that video. Try again." };

  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/playlists");
  return null;
}

export async function removePlaylistTrack(input: RemoveTrackInput): Promise<PlaylistActionState> {
  if (!input.playlistId || !Number.isInteger(input.position) || input.position < 1) {
    return { error: "That playlist item could not be removed." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Sign in to remove items from a playlist." };
  if (!(await getOwnedPlaylist(supabase, input.playlistId, user.id))) {
    return { error: "You can only edit playlists you own." };
  }

  const { error } = await supabase
    .from("playlist_tracks")
    .delete()
    .eq("playlist_id", input.playlistId)
    .eq("position", input.position);
  if (error) return { error: "Could not remove that item. Try again." };

  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/playlists");
  return null;
}
