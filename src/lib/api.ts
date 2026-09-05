import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type FeedType = "home" | "shorts" | "learn";
export type Profile = Tables<"profiles">;

export type PostWithAuthor = Tables<"posts"> & {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "location"> | null;
};

const POST_SELECT =
  "*, author:profiles!posts_author_profile_fkey(id, username, display_name, avatar_url, location)";

export function feedQuery(feed: FeedType) {
  return queryOptions({
    queryKey: ["feed", feed],
    queryFn: async (): Promise<PostWithAuthor[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("feed", feed)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as PostWithAuthor[];
    },
  });
}

export function postQuery(id: string) {
  return queryOptions({
    queryKey: ["post", id],
    queryFn: async (): Promise<PostWithAuthor | null> => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as PostWithAuthor | null;
    },
  });
}

export function profileQuery(username: string) {
  return queryOptions({
    queryKey: ["profile", username],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function profilePostsQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["profile-posts", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PostWithAuthor[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("author_id", userId as string)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PostWithAuthor[];
    },
  });
}

export type CommentWithAuthor = Tables<"comments"> & {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
};

export function commentsQuery(postId: string) {
  return queryOptions({
    queryKey: ["comments", postId],
    queryFn: async (): Promise<CommentWithAuthor[]> => {
      const { data, error } = await supabase
        .from("comments")
        .select(
          "*, author:profiles!comments_author_profile_fkey(id, username, display_name, avatar_url)",
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CommentWithAuthor[];
    },
  });
}

export function myLikesQuery(userId: string | null | undefined) {
  return queryOptions({
    queryKey: ["my-likes", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", userId as string);
      if (error) throw error;
      return (data ?? []).map((row) => row.post_id);
    },
  });
}

export function myFollowsQuery(userId: string | null | undefined) {
  return queryOptions({
    queryKey: ["my-follows", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId as string);
      if (error) throw error;
      return (data ?? []).map((row) => row.following_id);
    },
  });
}

export type NotificationRow = Tables<"notifications"> & {
  actor: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
};

export function notificationsQuery(userId: string | null | undefined) {
  return queryOptions({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "*, actor:profiles!notifications_actor_profile_fkey(id, username, display_name, avatar_url)",
        )
        .eq("user_id", userId as string)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });
}

export function searchQuery(term: string) {
  return queryOptions({
    queryKey: ["search", term],
    enabled: term.trim().length > 1,
    queryFn: async () => {
      const like = `%${term.trim()}%`;
      const [people, posts] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .or(`username.ilike.${like},display_name.ilike.${like}`)
          .limit(12),
        supabase
          .from("posts")
          .select(POST_SELECT)
          .eq("status", "published")
          .or(`title.ilike.${like},caption.ilike.${like}`)
          .limit(20),
      ]);
      if (people.error) throw people.error;
      if (posts.error) throw posts.error;
      return {
        people: (people.data ?? []) as Profile[],
        posts: (posts.data ?? []) as PostWithAuthor[],
      };
    },
  });
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("likes").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function toggleFollow(targetId: string, userId: string, following: boolean) {
  if (following) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("following_id", targetId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: userId, following_id: targetId });
    if (error) throw error;
  }
}

export function adminStatsQuery() {
  return queryOptions({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const [users, posts, comments, flagged] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("posts").select("id", { count: "exact", head: true }),
        supabase.from("comments").select("id", { count: "exact", head: true }),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .neq("status", "published"),
      ]);
      return {
        users: users.count ?? 0,
        posts: posts.count ?? 0,
        comments: comments.count ?? 0,
        flagged: flagged.count ?? 0,
      };
    },
  });
}

export function adminPostsQuery() {
  return queryOptions({
    queryKey: ["admin", "posts"],
    queryFn: async (): Promise<PostWithAuthor[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PostWithAuthor[];
    },
  });
}
