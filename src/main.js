import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BadgeCheck, Check, Flame, Footprints, HeartPulse, MessageCircle, Plus, Share2, Sparkles, ThumbsUp, Trophy, X } from "lucide-react";

const h = React.createElement;
const GOALS_KEY = "pulsepal-goals";
const POSTS_KEY = "pulsepal-posts";

const mockPosts = [
  { id: "post-1", username: "Maya", goalTitle: "Walked 10,000 steps", timestamp: new Date(Date.now() - 1000 * 60 * 28).toISOString(), reactions: { fire: 14, like: 9, flex: 7 } },
  { id: "post-2", username: "Jordan", goalTitle: "Stretch for 10 minutes", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), reactions: { fire: 6, like: 12, flex: 5 } },
  { id: "post-3", username: "Ari", goalTitle: "Drank 2L of water", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(), reactions: { fire: 8, like: 18, flex: 4 } }
];

function getGoalSuggestions() {
  return ["Go to the gym today", "Drink 2L of water", "Walk 10,000 steps", "Stretch for 10 minutes", "Sleep before 10pm", "Do 20 pushups", "Take a 15-minute walk outside", "Eat a healthy meal today"];
}

function readStoredValue(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function relativeTime(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return Math.round(hours / 24) + "d ago";
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const [goals, setGoals] = useState(() => readStoredValue(GOALS_KEY, [
    { id: crypto.randomUUID(), title: "Take a 15-minute walk outside", description: "Clear the head and get sunlight.", completed: false, createdAt: new Date().toISOString() },
    { id: crypto.randomUUID(), title: "Drink 2L of water", description: "", completed: false, createdAt: new Date().toISOString() }
  ]));
  const [posts, setPosts] = useState(() => readStoredValue(POSTS_KEY, mockPosts));
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [celebratingGoalId, setCelebratingGoalId] = useState(null);

  useEffect(() => localStorage.setItem(GOALS_KEY, JSON.stringify(goals)), [goals]);
  useEffect(() => localStorage.setItem(POSTS_KEY, JSON.stringify(posts)), [posts]);

  const activeGoals = useMemo(() => goals.filter((goal) => !goal.completed), [goals]);
  const completedGoals = useMemo(() => goals.filter((goal) => goal.completed).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)), [goals]);
  const completedToday = completedGoals.filter((goal) => new Date(goal.completedAt).toDateString() === new Date().toDateString()).length;
  const totalToday = activeGoals.length + completedToday;
  const progress = totalToday ? Math.round((completedToday / totalToday) * 100) : 0;
  const streak = Math.max(1, new Set(completedGoals.map((goal) => new Date(goal.completedAt).toDateString())).size);

  function addGoal(event) {
    event.preventDefault();
    if (!title.trim()) return;
    setGoals((current) => [{ id: crypto.randomUUID(), title: title.trim(), description: description.trim(), completed: false, createdAt: new Date().toISOString() }, ...current]);
    setTitle("");
    setDescription("");
    setShowSuggestions(false);
    setComposerOpen(false);
  }

  function completeGoal(goalId) {
    setCelebratingGoalId(goalId);
    window.setTimeout(() => {
      setGoals((current) => current.map((goal) => goal.id === goalId ? { ...goal, completed: true, completedAt: new Date().toISOString() } : goal));
      setCelebratingGoalId(null);
    }, 360);
  }

  function shareGoal(goal) {
    setPosts((current) => [{ id: crypto.randomUUID(), username: "You", goalTitle: goal.title, timestamp: new Date().toISOString(), reactions: { fire: 0, like: 0, flex: 0 } }, ...current]);
    setTab("feed");
  }

  function reactToPost(postId, type) {
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, reactions: { ...post.reactions, [type]: post.reactions[type] + 1 } } : post));
  }

  return h("main", { className: "app-shell" },
    h("section", { className: "hero" },
      h("div", null,
        h("p", { className: "eyebrow" }, "PulsePal"),
        h("h1", null, "Small wins, shared momentum."),
        h("p", { className: "hero-copy" }, "Track wellness goals, finish today strong, and post the wins worth cheering for.")
      ),
      h("div", { className: "hero-stats", "aria-label": "Today's progress" },
        h("div", { className: "progress-ring", style: { "--progress": progress + "%" } }, h("span", null, progress + "%")),
        h("div", null, h("strong", null, completedToday + "/" + (totalToday || 1)), h("span", null, "goals done today"))
      )
    ),
    h("nav", { className: "tabs", "aria-label": "Primary navigation" },
      h("button", { className: tab === "dashboard" ? "active" : "", onClick: () => setTab("dashboard") }, h(HeartPulse, { size: 18 }), "Dashboard"),
      h("button", { className: tab === "feed" ? "active" : "", onClick: () => setTab("feed") }, h(MessageCircle, { size: 18 }), "Feed")
    ),
    tab === "dashboard"
      ? h(Dashboard, { activeGoals, completedGoals, completedToday, totalToday, streak, isComposerOpen, setComposerOpen, title, setTitle, description, setDescription, showSuggestions, setShowSuggestions, addGoal, completeGoal, celebratingGoalId, shareGoal })
      : h(Feed, { posts, reactToPost })
  );
}

function Dashboard(props) {
  return h("section", { className: "dashboard-grid" },
    h("div", { className: "main-column" },
      h("div", { className: "section-heading" },
        h("div", null, h("p", { className: "eyebrow" }, "Today"), h("h2", null, "Active goals")),
        h("button", { className: "primary-action", onClick: () => { props.setComposerOpen(true); props.setShowSuggestions(true); } }, h(Plus, { size: 18 }), "Add Goal")
      ),
      props.isComposerOpen ? h(Composer, props) : null,
      h("div", { className: "goal-list" }, props.activeGoals.length ? props.activeGoals.map((goal) => h(GoalCard, { key: goal.id, goal, onComplete: props.completeGoal, isCelebrating: props.celebratingGoalId === goal.id })) : h(EmptyState))
    ),
    h("aside", { className: "side-column" },
      h("div", { className: "mini-stats" },
        h(Stat, { icon: h(BadgeCheck), label: "Done today", value: props.completedToday }),
        h(Stat, { icon: h(Flame), label: "Daily streak", value: props.streak + "d" }),
        h(Stat, { icon: h(Footprints), label: "In motion", value: props.totalToday || 1 })
      ),
      h("div", { className: "completed-panel" },
        h("div", { className: "section-heading compact" }, h("div", null, h("p", { className: "eyebrow" }, "Archive"), h("h2", null, "Completed"))),
        h("div", { className: "completed-list" }, props.completedGoals.length ? props.completedGoals.map((goal) =>
          h("article", { className: "completed-item", key: goal.id },
            h("div", null, h("strong", null, goal.title), h("span", null, formatTime(goal.completedAt))),
            h("button", { onClick: () => props.shareGoal(goal) }, h(Share2, { size: 16 }), "Share")
          )
        ) : h("p", { className: "muted" }, "Finished goals will land here, ready to share."))
      )
    )
  );
}

function Composer(props) {
  return h("form", { className: "composer", onSubmit: props.addGoal },
    h("div", { className: "composer-title" }, h(Sparkles, { size: 19 }), h("span", null, "Create Goal"), h("button", { type: "button", className: "icon-button", onClick: () => props.setComposerOpen(false), "aria-label": "Close" }, h(X, { size: 18 }))),
    h("label", null, "Goal title", h("input", { value: props.title, onChange: (event) => props.setTitle(event.target.value), onFocus: () => props.setShowSuggestions(true), onClick: () => props.setShowSuggestions(true), placeholder: "What are you doing today?", autoFocus: true })),
    props.showSuggestions ? h("div", { className: "suggestions" }, getGoalSuggestions().map((suggestion) =>
      h("button", { key: suggestion, type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => { props.setTitle(suggestion); props.setShowSuggestions(false); } }, suggestion)
    )) : null,
    h("label", null, "Description", h("textarea", { value: props.description, onChange: (event) => props.setDescription(event.target.value), placeholder: "Add a note, location, or tiny promise to yourself.", rows: 3 })),
    h("button", { className: "save-button", type: "submit" }, h(Check, { size: 18 }), "Save goal")
  );
}

function GoalCard({ goal, onComplete, isCelebrating }) {
  return h("article", { className: "goal-card " + (isCelebrating ? "complete-animating" : "") },
    h("button", { className: "done-button", onClick: () => onComplete(goal.id), "aria-label": "Mark " + goal.title + " as done" }, h(Check, { size: 20 })),
    h("div", null, h("h3", null, goal.title), goal.description ? h("p", null, goal.description) : null, h("span", null, "Created " + relativeTime(goal.createdAt))),
    h("div", { className: "check-burst", "aria-hidden": "true" }, h(Check, { size: 34 }))
  );
}

function EmptyState() {
  return h("div", { className: "empty-state" }, h(Trophy, { size: 28 }), h("h3", null, "No active goals yet"), h("p", null, "Add one quick win and let the day start moving."));
}

function Stat({ icon, label, value }) {
  return h("div", { className: "stat" }, icon, h("span", null, label), h("strong", null, value));
}

function Feed({ posts, reactToPost }) {
  return h("section", { className: "feed-view" },
    h("div", { className: "section-heading" }, h("div", null, h("p", { className: "eyebrow" }, "Social"), h("h2", null, "Fitness feed"))),
    h("div", { className: "post-list" }, posts.map((post) =>
      h("article", { className: "post-card", key: post.id },
        h("div", { className: "post-topline" }, h("div", { className: "avatar" }, post.username.slice(0, 1)), h("div", null, h("strong", null, post.username), h("span", null, relativeTime(post.timestamp)))),
        h("p", null, "Completed ", h("strong", null, post.goalTitle)),
        h("div", { className: "reaction-row" },
          h("button", { onClick: () => reactToPost(post.id, "fire") }, h(Flame, { size: 17 }), post.reactions.fire),
          h("button", { onClick: () => reactToPost(post.id, "like") }, h(ThumbsUp, { size: 17 }), post.reactions.like),
          h("button", { onClick: () => reactToPost(post.id, "flex") }, h(Trophy, { size: 17 }), post.reactions.flex)
        )
      )
    ))
  );
}

createRoot(document.getElementById("root")).render(h(App));
