import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import type { PostWithAuthor } from "@/lib/api";
import { compactNumber, duration, timeAgo } from "@/lib/format";
import { useLikes, useFollows } from "@/hooks/useEngagement";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "./UserAvatar";
import { VideoPlayer } from "./VideoPlayer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  post: PostWithAuthor;
  vertical?: boolean;
};

export function PostCard({ post, vertical = false }: Props) {
  const likes = useLikes();
  const follows = useFollows();
  const { user } = useAuth();
  const liked = likes.isLiked(post.id);
  const author = post.author;
  const isOwn = user?.id === post.author_id;

  const share = async () => {
    const url = `${window.location.origin}/video/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: post.title || "Xora", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <article className="rise overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-shadow duration-200 hover:shadow-lift">
      <header className="flex items-center gap-3 px-3 pt-3">
        <Link
          to="/profile/$username"
          params={{ username: author?.username ?? "" }}
          className="press flex min-w-0 items-center gap-3"
        >
          <UserAvatar path={author?.avatar_url} name={author?.display_name} size={40} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold">
              {author?.display_name || author?.username}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {timeAgo(post.created_at)}
              {author?.location ? ` · ${author.location}` : ""}
            </span>
          </span>
        </Link>
        {!isOwn && author ? (
          <button
            type="button"
            onClick={() => follows.toggle(author.id)}
            disabled={follows.pending}
            className={cn(
              "press ml-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60",
              follows.isFollowing(author.id)
                ? "bg-secondary text-secondary-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {follows.isFollowing(author.id) ? "Following" : "Follow"}
          </button>
        ) : null}
      </header>

      <div className="px-3 pt-3">
        {post.kind === "video" ? (
          <div className="relative">
            <VideoPlayer
              mediaPath={post.media_path}
              posterPath={post.poster_path}
              vertical={vertical}
              title={post.title || "Xora video"}
            />
            {post.duration_seconds ? (
              <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-ink/70 px-2 py-1 font-mono text-[10px] text-background">
                {duration(post.duration_seconds)}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 px-4 py-5 text-[15px] leading-relaxed text-foreground text-pretty">
            {post.caption}
          </p>
        )}
      </div>

      <div className="px-3 pb-3 pt-3">
        {post.title ? (
          <Link to="/video/$postId" params={{ postId: post.id }} className="block">
            <h3 className="font-display text-[17px] font-semibold leading-snug text-balance hover:text-primary">
              {post.title}
            </h3>
          </Link>
        ) : null}
        {post.kind === "video" && post.caption ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {post.caption}
          </p>
        ) : null}

        <div className="mt-3 flex items-center gap-1 border-t border-border pt-2.5">
          <button
            type="button"
            onClick={() => likes.toggle(post.id)}
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
            className="press flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            <Heart
              className={cn("size-4", liked ? "pop fill-primary text-primary" : "")}
              aria-hidden="true"
            />
            <span className="tabular-nums">{compactNumber(post.like_count)}</span>
          </button>
          <Link
            to="/video/$postId"
            params={{ postId: post.id }}
            hash="comments"
            aria-label="Comments"
            className="press flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            <span className="tabular-nums">{compactNumber(post.comment_count)}</span>
          </Link>
          <button
            type="button"
            onClick={share}
            aria-label="Share"
            className="press flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            <Share2 className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>
    </article>
  );
}
