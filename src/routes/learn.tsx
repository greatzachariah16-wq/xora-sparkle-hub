import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, Clock3, Search, Sparkles, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/xora/AppShell";
import { UserAvatar } from "@/components/xora/UserAvatar";
import { TrendingRail } from "@/components/xora/TrendingRail";
import { EmptyState, ErrorState } from "@/components/xora/EmptyState";
import { FeedSkeleton } from "@/components/xora/Skeletons";
import { feedQuery, type PostWithAuthor } from "@/lib/api";
import { cn } from "@/lib/utils";

const categories = ["All", "Technology", "Business", "Design", "Creator", "Career"] as const;

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Learn — Xora" },
      {
        name: "description",
        content: "Practical lessons and walkthroughs from Xora creators.",
      },
    ],
  }),
  component: Learn,
});

function Learn() {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [search, setSearch] = useState("");
  const { data, isPending, isError, error, refetch } = useQuery(feedQuery("learn"));

  const courses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((post) => {
      const categoryMatch =
        category === "All" || (post.category ?? "").toLowerCase() === category.toLowerCase();
      const searchMatch =
        !term ||
        [post.title, post.caption, post.external_creator, post.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return categoryMatch && searchMatch;
    });
  }, [category, data, search]);

  return (
    <AppShell rail={<TrendingRail />} wide>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-card">
          <div className="bg-gradient-to-br from-clay-soft via-surface to-secondary p-5 sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" /> Xora Learn
            </span>
            <div className="mt-4 max-w-2xl">
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                Learn something useful. Build something real.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Practical lessons, creator walkthroughs and skills you can take straight into your next project.
              </p>
            </div>
            <label className="mt-6 flex max-w-2xl items-center gap-3 rounded-2xl border border-border bg-background/90 px-4 py-3 shadow-card focus-within:ring-2 focus-within:ring-ring">
              <Search className="size-5 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search lessons, skills or creators"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                aria-label="Search lessons"
              />
            </label>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: BookOpen, title: "Practical", text: "Learn by following useful, focused lessons." },
            { icon: Users, title: "Creator-led", text: "Discover knowledge from people who make things." },
            { icon: Clock3, title: "Learn your way", text: "Save time with short, focused sessions." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl border border-border bg-surface p-4 shadow-card">
              <div className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-3 font-display text-base font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                "press shrink-0 rounded-full border px-4 py-2 text-sm font-medium",
                category === item
                  ? "border-primary bg-primary text-primary-foreground shadow-card"
                  : "border-border bg-surface text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        {isPending ? (
          <FeedSkeleton />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : !courses.length ? (
          <EmptyState
            icon={BookOpen}
            title="No lessons found"
            description="Try another search or category, or be the first creator to publish a lesson."
            action={
              <Link
                to="/create"
                className="press inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Create a lesson
              </Link>
            }
          />
        ) : (
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Explore</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">Lessons for you</h2>
              </div>
              <span className="text-xs text-muted-foreground">{courses.length} available</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {courses.map((post) => (
                <LessonCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function LessonCard({ post }: { post: PostWithAuthor }) {
  const image = post.thumbnail_url ?? post.poster_path;
  const minutes = post.duration_seconds ? Math.max(1, Math.round(post.duration_seconds / 60)) : null;
  const category = post.category ?? "Lesson";

  return (
    <Link
      to="/video/$postId"
      params={{ postId: post.id }}
      className="group overflow-hidden rounded-3xl border border-border bg-surface shadow-card transition-transform hover:-translate-y-0.5"
    >
      <div className="aspect-[16/9] overflow-hidden bg-secondary">
        {image ? (
          <img
            src={image}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="grid size-full place-items-center bg-secondary text-primary">
            <BookOpen className="size-9" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {category}
          </span>
          {minutes ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" /> {minutes} min
            </span>
          ) : null}
        </div>
        <h3 className="mt-3 line-clamp-2 font-display text-lg font-semibold">{post.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{post.caption}</p>
        <div className="mt-4 flex items-center gap-2">
          <UserAvatar path={post.author?.avatar_url} name={post.author?.display_name} size={28} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{post.author?.display_name ?? "Xora Creator"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              @{post.author?.username ?? "creator"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
