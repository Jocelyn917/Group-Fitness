import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  BadgeCheck,
  Bell,
  Check,
  Flame,
  Heart,
  HeartPulse,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  Sun,
  Trophy,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const h = React.createElement;
const isConfigured = !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");
const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const defaultBadges = [
  { name: "First Goal", description: "Created your first fitness goal", icon: "spark" },
  { name: "First Completion", description: "Completed your first goal", icon: "check" },
  { name: "3-Day Streak", description: "Completed goals three days in a row", icon: "flame" },
  { name: "7-Day Streak", description: "Held a week-long streak", icon: "trophy" },
  { name: "10 Goals Completed", description: "Completed ten goals", icon: "badge" },
  { name: "Hydration Hero", description: "Completed a hydration goal", icon: "water" },
  { name: "Gym Starter", description: "Completed a gym goal", icon: "gym" },
  { name: "Sleep Champion", description: "Completed a sleep goal", icon: "moon" }
];

function getGoalSuggestions() {
  return [
    "Go to the gym today",
    "Drink 2L of water",
    "Walk 10,000 steps",
    "Stretch for 10 minutes",
    "Sleep before 10pm",
    "Do 20 pushups",
    "Take a 15-minute walk",
    "Eat a healthy meal",
    "Do a 20-minute workout",
    "Meditate for 5 minutes",
    "Take a rest day",
    "Meal prep",
    "Complete today's workout",
    "Use the stairs today",
    "Cycling session"
  ];
}

const categories = ["Fitness", "Hydration", "Sleep", "Nutrition", "Recovery", "Mindfulness"];
const visibilityOptions = ["public", "friends", "private"];

function formatTime(value) {
  if (!value) return "Not completed";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function getCurrentStreak(goals) {
  const completedDays = new Set(goals.filter((goal) => goal.completed_at).map((goal) => dayKey(goal.completed_at)));
  let streak = 0;
  const cursor = new Date();
  while (completedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function groupGoalsByOwner(goals) {
  return goals.reduce((groups, goal) => {
    const ownerName = goal.profiles?.display_name || "Fitness friend";
    if (!groups[ownerName]) groups[ownerName] = [];
    groups[ownerName].push(goal);
    return groups;
  }, {});
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [goals, setGoals] = useState([]);
  const [feedGoals, setFeedGoals] = useState([]);
  const [commentsByGoal, setCommentsByGoal] = useState({});
  const [friends, setFriends] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authMode, setAuthMode] = useState("landing");
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [toast, setToast] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    loadEverything(session.user.id);
  }, [session]);

  async function loadEverything(userId = session?.user?.id) {
    if (!supabase || !userId) return;
    setLoading(true);
    await ensureProfile();
    await Promise.all([loadGoals(), loadFeed(), loadFriends(), loadProfiles(), loadNotifications(), loadBadges()]);
    setLoading(false);
  }

  async function ensureProfile() {
    const user = session?.user;
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) {
      setProfile(data);
      return data;
    }
    const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "PulsePal User";
    const { data: created } = await supabase.from("profiles").insert({ id: user.id, email: user.email, display_name: displayName }).select("*").single();
    setProfile(created);
    return created;
  }

  async function loadGoals() {
    const { data } = await supabase.from("goals").select("*, profiles:owner_id(display_name, avatar_url)").eq("owner_id", session.user.id).order("created_at", { ascending: false });
    setGoals(data || []);
  }

  async function loadFeed() {
    const { data: visibleGoals } = await supabase.from("goals_with_counts").select("*").order("created_at", { ascending: false });
    setFeedGoals(visibleGoals || []);
  }

  async function loadProfiles() {
    const { data } = await supabase.from("profiles").select("*").neq("id", session.user.id).order("display_name");
    setProfiles(data || []);
  }

  async function loadFriends() {
    const { data } = await supabase.from("friendships").select("*, requester:requester_id(display_name, avatar_url), receiver:receiver_id(display_name, avatar_url)").or("requester_id.eq." + session.user.id + ",receiver_id.eq." + session.user.id).order("created_at", { ascending: false });
    setFriends(data || []);
  }

  async function loadNotifications() {
    const { data } = await supabase.from("notifications").select("*, sender:sender_id(display_name), goals(title)").eq("user_id", session.user.id).order("created_at", { ascending: false });
    setNotifications(data || []);
  }

  async function loadBadges() {
    const { data } = await supabase.from("user_badges").select("*, badges(name, description, icon)").eq("user_id", session.user.id).order("earned_at", { ascending: false });
    setBadges(data || []);
  }

  async function signUp(form) {
    if (form.password !== form.confirmPassword) return setToast("Passwords do not match.");
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { display_name: form.displayName } }
    });
    if (error) return setToast(error.message);
    setToast("Account created. Check your email if confirmation is enabled, then log in.");
    setAuthMode("login");
  }

  async function login(form) {
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    if (error) return setToast(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
    setTab("dashboard");
  }

  async function saveGoal(form) {
    const payload = {
      owner_id: session.user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      visibility: form.visibility,
      progress_type: "checkbox"
    };
    if (!payload.title) return setToast("Goal title is required.");
    if (editingGoal) {
      await supabase.from("goals").update(payload).eq("id", editingGoal.id).eq("owner_id", session.user.id);
    } else {
      await supabase.from("goals").insert(payload);
      await awardBadgesForEvent("goal_created", payload);
    }
    setGoalModalOpen(false);
    setEditingGoal(null);
    await loadEverything();
  }

  async function completeGoal(goal) {
    if (goal.owner_id !== session.user.id) return;
    await supabase.from("goals").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", goal.id).eq("owner_id", session.user.id);
    await awardBadgesForEvent("goal_completed", goal);
    setToast("Goal completed. Nice work.");
    await loadEverything();
  }

  async function deleteGoal(goal) {
    if (goal.owner_id !== session.user.id) return;
    await supabase.from("goals").delete().eq("id", goal.id).eq("owner_id", session.user.id);
    await loadEverything();
  }

  async function toggleLike(goal) {
    if (goal.owner_id === session.user.id) return setToast("You cannot like your own goal.");
    const existing = goal.viewer_liked;
    if (existing) await supabase.from("goal_likes").delete().eq("goal_id", goal.id).eq("user_id", session.user.id);
    else {
      await supabase.from("goal_likes").insert({ goal_id: goal.id, user_id: session.user.id });
      await notify(goal.owner_id, "like", goal.id);
    }
    await loadFeed();
  }

  async function loadComments(goalId) {
    const { data } = await supabase.from("goal_comments").select("*, profiles:user_id(display_name)").eq("goal_id", goalId).order("created_at", { ascending: false });
    setCommentsByGoal((current) => ({ ...current, [goalId]: data || [] }));
  }

  async function addComment(goal, comment) {
    if (!comment.trim()) return;
    await supabase.from("goal_comments").insert({ goal_id: goal.id, user_id: session.user.id, comment: comment.trim() });
    if (goal.owner_id !== session.user.id) await notify(goal.owner_id, "comment", goal.id);
    await loadComments(goal.id);
  }

  async function deleteComment(comment, goal) {
    const canDelete = comment.user_id === session.user.id || goal.owner_id === session.user.id;
    if (!canDelete) return;
    await supabase.from("goal_comments").delete().eq("id", comment.id);
    await loadComments(goal.id);
  }

  async function sendFriendRequest(receiverId) {
    await supabase.from("friendships").insert({ requester_id: session.user.id, receiver_id: receiverId, status: "pending" });
    await notify(receiverId, "friend_request", null);
    await loadFriends();
  }

  async function updateFriendship(friendship, status) {
    await supabase.from("friendships").update({ status }).eq("id", friendship.id);
    if (status === "accepted") await notify(friendship.requester_id, "friend_accepted", null);
    await Promise.all([loadFriends(), loadNotifications()]);
  }

  async function removeFriend(friendship) {
    await supabase.from("friendships").delete().eq("id", friendship.id);
    await loadFriends();
  }

  async function notify(userId, type, goalId) {
    if (!userId || userId === session.user.id) return;
    await supabase.from("notifications").insert({ user_id: userId, type, sender_id: session.user.id, goal_id: goalId, read: false });
  }

  async function markNotificationRead(notification) {
    await supabase.from("notifications").update({ read: true }).eq("id", notification.id).eq("user_id", session.user.id);
    await loadNotifications();
  }

  async function awardBadgesForEvent(event, goal) {
    const { data: allBadges } = await supabase.from("badges").select("*");
    const badgeMap = new Map((allBadges || defaultBadges).map((badge) => [badge.name, badge]));
    const completed = goals.filter((item) => item.completed_at).length + (event === "goal_completed" ? 1 : 0);
    const streak = getCurrentStreak([...goals, event === "goal_completed" ? { completed_at: new Date().toISOString() } : {}]);
    const names = [];
    if (event === "goal_created") names.push("First Goal");
    if (event === "goal_completed") names.push("First Completion");
    if (streak >= 3) names.push("3-Day Streak");
    if (streak >= 7) names.push("7-Day Streak");
    if (completed >= 10) names.push("10 Goals Completed");
    if (/water|hydration/i.test(goal.title)) names.push("Hydration Hero");
    if (/gym|workout/i.test(goal.title)) names.push("Gym Starter");
    if (/sleep/i.test(goal.title)) names.push("Sleep Champion");
    for (const name of names) {
      const badge = badgeMap.get(name);
      if (badge?.id) {
        const { error } = await supabase.from("user_badges").insert({ user_id: session.user.id, badge_id: badge.id });
        if (!error) {
          setToast("Badge earned: " + name);
          await supabase.from("notifications").insert({ user_id: session.user.id, type: "badge", read: false });
        }
      }
    }
  }

  if (!isConfigured) return h(SetupScreen);
  if (loading) return h("main", { className: "app-shell" }, h("div", { className: "loading-card" }, "Loading PulsePal..."));
  if (!session) return h(AuthShell, { authMode, setAuthMode, signUp, login, toast });

  const completed = goals.filter((goal) => goal.completed);
  const streak = getCurrentStreak(goals);
  const unreadCount = notifications.filter((item) => !item.read).length;

  return h("main", { className: "app-shell" },
    toast ? h("div", { className: "toast", onAnimationEnd: () => setToast("") }, toast) : null,
    h(Header, { profile, logout, tab, setTab, unreadCount, darkMode, setDarkMode }),
    tab === "dashboard" ? h(Dashboard, { goals, completed, streak, setGoalModalOpen, setEditingGoal, completeGoal, deleteGoal, feedGoals }) : null,
    tab === "feed" ? h(Feed, { feedGoals, commentsByGoal, loadComments, addComment, deleteComment, toggleLike, userId: session.user.id }) : null,
    tab === "friends" ? h(FriendsPage, { profiles, friends, userId: session.user.id, sendFriendRequest, updateFriendship, removeFriend }) : null,
    tab === "profile" ? h(ProfilePage, { profile, goals, badges, friends, streak }) : null,
    tab === "notifications" ? h(NotificationsPage, { notifications, markNotificationRead }) : null,
    goalModalOpen ? h(GoalModal, { goal: editingGoal, onClose: () => { setGoalModalOpen(false); setEditingGoal(null); }, onSave: saveGoal }) : null
  );
}


const LOCAL_USERS_KEY = "pulsepal-local-users";
const LOCAL_SESSION_KEY = "pulsepal-local-session";
const LOCAL_GOALS_KEY = "pulsepal-local-goals";
const LOCAL_NOTIFICATIONS_KEY = "pulsepal-local-notifications";

function readLocal(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function LocalDemoApp() {
  const [users, setUsers] = useState(() => readLocal(LOCAL_USERS_KEY, []));
  const [sessionUserId, setSessionUserId] = useState(() => readLocal(LOCAL_SESSION_KEY, null));
  const [goals, setGoals] = useState(() => readLocal(LOCAL_GOALS_KEY, []));
  const [notifications, setNotifications] = useState(() => readLocal(LOCAL_NOTIFICATIONS_KEY, []));
  const [authMode, setAuthMode] = useState("landing");
  const [tab, setTab] = useState("dashboard");
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [toast, setToast] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  const user = users.find((item) => item.id === sessionUserId) || null;
  const profile = user ? { id: user.id, display_name: user.displayName, email: user.email, bio: user.bio || "Local demo account" } : null;

  useEffect(() => writeLocal(LOCAL_USERS_KEY, users), [users]);
  useEffect(() => writeLocal(LOCAL_SESSION_KEY, sessionUserId), [sessionUserId]);
  useEffect(() => writeLocal(LOCAL_GOALS_KEY, goals), [goals]);
  useEffect(() => writeLocal(LOCAL_NOTIFICATIONS_KEY, notifications), [notifications]);
  useEffect(() => document.body.classList.toggle("dark", darkMode), [darkMode]);

  function signUp(form) {
    if (form.password !== form.confirmPassword) return setToast("Passwords do not match.");
    if (users.some((item) => item.email.toLowerCase() === form.email.toLowerCase())) return setToast("That email already has an account.");
    const nextUser = { id: crypto.randomUUID(), displayName: form.displayName.trim() || form.email.split("@")[0], email: form.email.trim(), password: form.password, createdAt: new Date().toISOString() };
    setUsers((current) => [...current, nextUser]);
    setSessionUserId(nextUser.id);
    setToast("Account created. You are logged in.");
  }

  function login(form) {
    const found = users.find((item) => item.email.toLowerCase() === form.email.toLowerCase() && item.password === form.password);
    if (!found) return setToast("Email or password is incorrect.");
    setSessionUserId(found.id);
    setToast("Welcome back.");
  }

  function logout() {
    setSessionUserId(null);
    setTab("dashboard");
  }

  function saveGoal(form) {
    if (!form.title.trim()) return setToast("Goal title is required.");
    if (editingGoal) {
      setGoals((current) => current.map((goal) => goal.id === editingGoal.id && goal.owner_id === user.id ? { ...goal, title: form.title.trim(), description: form.description.trim(), category: form.category, visibility: form.visibility } : goal));
    } else {
      setGoals((current) => [{ id: crypto.randomUUID(), owner_id: user.id, title: form.title.trim(), description: form.description.trim(), category: form.category, visibility: form.visibility, progress_type: "checkbox", completed: false, created_at: new Date().toISOString(), completed_at: null }, ...current]);
      setNotifications((current) => [{ id: crypto.randomUUID(), user_id: user.id, type: "badge", read: false, created_at: new Date().toISOString(), local_text: "Badge earned: First Goal" }, ...current]);
    }
    setGoalModalOpen(false);
    setEditingGoal(null);
  }

  function completeGoal(goal) {
    if (goal.owner_id !== user.id) return;
    setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, completed: true, completed_at: new Date().toISOString() } : item));
    setNotifications((current) => [{ id: crypto.randomUUID(), user_id: user.id, type: "badge", read: false, created_at: new Date().toISOString(), local_text: "Badge earned: First Completion" }, ...current]);
    setToast("Goal completed. Nice work.");
  }

  function deleteGoal(goal) {
    setGoals((current) => current.filter((item) => !(item.id === goal.id && item.owner_id === user.id)));
  }

  function markNotificationRead(notification) {
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
  }

  function toggleLike(goal) {
    if (goal.owner_id === user.id) return setToast("You cannot like your own goal.");
    setGoals((current) => current.map((item) => {
      if (item.id !== goal.id) return item;
      const likedBy = item.likedBy || [];
      const hasLiked = likedBy.includes(user.id);
      return { ...item, likedBy: hasLiked ? likedBy.filter((id) => id !== user.id) : [...likedBy, user.id] };
    }));
  }

  function addComment(goal, comment) {
    if (!comment.trim()) return;
    setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, comments: [{ id: crypto.randomUUID(), user_id: user.id, comment: comment.trim(), created_at: new Date().toISOString(), profiles: { display_name: user.displayName } }, ...(item.comments || [])] } : item));
  }

  function deleteComment(comment, goal) {
    setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, comments: (item.comments || []).filter((entry) => entry.id !== comment.id || (comment.user_id !== user.id && goal.owner_id !== user.id)) } : item));
  }

  function localFeedGoals() {
    return goals
      .filter((goal) => goal.visibility === "public" || goal.owner_id === user.id)
      .map((goal) => {
        const owner = users.find((item) => item.id === goal.owner_id);
        return { ...goal, owner_name: owner?.displayName || "Fitness friend", like_count: (goal.likedBy || []).length, comment_count: (goal.comments || []).length, viewer_liked: (goal.likedBy || []).includes(user.id) };
      });
  }

  if (!user) return h(AuthShell, { authMode, setAuthMode, signUp, login, toast });

  const myGoals = goals.filter((goal) => goal.owner_id === user.id);
  const completed = myGoals.filter((goal) => goal.completed);
  const feedGoals = localFeedGoals();
  const commentsByGoal = Object.fromEntries(feedGoals.map((goal) => [goal.id, goal.comments || []]));
  const unreadCount = notifications.filter((item) => !item.read && item.user_id === user.id).length;
  const localBadges = notifications.filter((item) => item.type === "badge" && item.user_id === user.id).map((item) => ({ id: item.id, badges: { name: item.local_text?.replace("Badge earned: ", "") || "Local Badge", description: "Earned in local demo mode" } }));

  return h("main", { className: "app-shell" },
    toast ? h("div", { className: "toast", onAnimationEnd: () => setToast("") }, toast) : null,
    h("div", { className: "local-mode-banner" }, "Local demo mode: sign up/login works without Supabase. Data is saved in this browser only."),
    h(Header, { profile, logout, tab, setTab, unreadCount, darkMode, setDarkMode }),
    tab === "dashboard" ? h(Dashboard, { goals: myGoals, completed, streak: getCurrentStreak(myGoals), setGoalModalOpen, setEditingGoal, completeGoal, deleteGoal, feedGoals }) : null,
    tab === "feed" ? h(Feed, { feedGoals, commentsByGoal, loadComments: async () => {}, addComment, deleteComment, toggleLike, userId: user.id }) : null,
    tab === "friends" ? h(LocalFriendsPage, { users, currentUser: user }) : null,
    tab === "profile" ? h(ProfilePage, { profile, goals: myGoals, badges: localBadges, friends: [], streak: getCurrentStreak(myGoals) }) : null,
    tab === "notifications" ? h(NotificationsPage, { notifications: notifications.filter((item) => item.user_id === user.id), markNotificationRead }) : null,
    goalModalOpen ? h(GoalModal, { goal: editingGoal, onClose: () => { setGoalModalOpen(false); setEditingGoal(null); }, onSave: saveGoal }) : null
  );
}

function LocalFriendsPage({ users, currentUser }) {
  const [query, setQuery] = useState("");
  const matches = users.filter((item) => item.id !== currentUser.id && item.displayName.toLowerCase().includes(query.toLowerCase()));
  return h("section", { className: "page-grid" },
    h("div", { className: "panel" },
      h("p", { className: "eyebrow" }, "Friends"),
      h("h2", null, "Local user search"),
      h("label", { className: "search-box" }, h(Search, { size: 17 }), h("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Search local demo users" })),
      matches.length ? matches.map((profile) => h("article", { className: "user-row", key: profile.id }, h("div", { className: "avatar" }, profile.displayName.slice(0, 1)), h("div", null, h("strong", null, profile.displayName), h("span", null, profile.email)), h("button", { disabled: true }, "Demo only"))) : h("p", { className: "muted" }, "Create another local account to see users here.")
    ),
    h("div", { className: "panel" }, h("h2", null, "Friend requests"), h("p", { className: "muted" }, "Friend requests need the Supabase backend to sync between real accounts.")),
    h("div", { className: "panel" }, h("h2", null, "Friend list"), h("p", { className: "muted" }, "Local mode keeps the interface ready, but real friend status is cloud-backed."))
  );
}

function SetupScreen() {
  return h("main", { className: "app-shell" },
    h("section", { className: "hero setup-hero" },
      h("div", null, h("p", { className: "eyebrow" }, "Supabase setup required"), h("h1", null, "Connect PulsePal to the cloud."), h("p", { className: "hero-copy" }, "Add your Supabase URL and anon key in src/supabase-config.js, then run the SQL in supabase-schema.sql to enable auth, profiles, goals, likes, comments, friends, notifications, badges, streaks, and row-level security.")),
      h("div", { className: "hero-stats" }, h(Sparkles), h("div", null, h("strong", null, "Ready"), h("span", null, "for multi-user data")))
    )
  );
}

function AuthShell({ authMode, setAuthMode, signUp, login, toast }) {
  return h("main", { className: "auth-shell" },
    h("section", { className: "landing" },
      h("p", { className: "eyebrow" }, "PulsePal"),
      h("h1", null, "Fitness goals feel better together."),
      h("p", null, "Create goals, share progress, cheer on friends, and keep your streak alive."),
      h("div", { className: "auth-actions" },
        h("button", { className: "primary-action", onClick: () => setAuthMode("login") }, "Login"),
        h("button", { className: "secondary-action", onClick: () => setAuthMode("signup") }, "Sign Up")
      )
    ),
    h(AuthForm, { mode: authMode, setAuthMode, signUp, login, toast })
  );
}

function AuthForm({ mode, setAuthMode, signUp, login, toast }) {
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirmPassword: "" });
  const isSignup = mode === "signup";
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  return h("form", { className: "auth-card", onSubmit: (event) => { event.preventDefault(); isSignup ? signUp(form) : login(form); } },
    h("h2", null, isSignup ? "Create account" : "Welcome back"),
    toast ? h("p", { className: "form-message" }, toast) : null,
    isSignup ? h("label", null, "Display name", h("input", { value: form.displayName, onChange: (event) => update("displayName", event.target.value), required: true })) : null,
    h("label", null, "Email", h("input", { type: "email", value: form.email, onChange: (event) => update("email", event.target.value), required: true })),
    h("label", null, "Password", h("input", { type: "password", value: form.password, onChange: (event) => update("password", event.target.value), required: true })),
    isSignup ? h("label", null, "Confirm password", h("input", { type: "password", value: form.confirmPassword, onChange: (event) => update("confirmPassword", event.target.value), required: true })) : null,
    h("button", { className: "save-button", type: "submit" }, isSignup ? "Sign Up" : "Login"),
    h("button", { type: "button", className: "link-button", onClick: () => setAuthMode(isSignup ? "login" : "signup") }, isSignup ? "Already have an account? Login" : "Need an account? Sign up")
  );
}

function Header({ profile, logout, tab, setTab, unreadCount, darkMode, setDarkMode }) {
  const tabs = [["dashboard", HeartPulse], ["feed", MessageCircle], ["friends", Users], ["profile", BadgeCheck], ["notifications", Bell]];
  return h("header", { className: "topbar" },
    h("div", { className: "brand" }, h("div", { className: "avatar" }, (profile?.display_name || "P").slice(0, 1)), h("div", null, h("strong", null, "PulsePal"), h("span", null, profile?.display_name || "Fitness friend"))),
    h("nav", { className: "app-nav" }, tabs.map(([name, Icon]) => h("button", { key: name, className: tab === name ? "active" : "", onClick: () => setTab(name) }, h(Icon, { size: 17 }), name === "notifications" && unreadCount ? "Notifications (" + unreadCount + ")" : name[0].toUpperCase() + name.slice(1)))),
    h("div", { className: "topbar-actions" },
      h("button", { className: "icon-button", onClick: () => setDarkMode(!darkMode), "aria-label": "Toggle dark mode" }, darkMode ? h(Sun, { size: 18 }) : h(Moon, { size: 18 })),
      h("button", { className: "logout-button", onClick: logout }, h(LogOut, { size: 17 }), "Logout")
    )
  );
}

function Dashboard({ goals, completed, streak, setGoalModalOpen, setEditingGoal, completeGoal, deleteGoal, feedGoals }) {
  const completionRate = goals.length ? Math.round((completed.length / goals.length) * 100) : 0;
  const active = goals.filter((goal) => !goal.completed);
  return h("section", null,
    h("section", { className: "hero dashboard-hero" },
      h("div", null, h("p", { className: "eyebrow" }, "Dashboard"), h("h1", null, "Today’s goals, social momentum."), h("p", { className: "hero-copy" }, "Track your private work and see the activity that keeps your circle moving.")),
      h("div", { className: "hero-stats" }, h("div", { className: "progress-ring", style: { "--progress": completionRate + "%" } }, h("span", null, completionRate + "%")), h("div", null, h("strong", null, streak + " day"), h("span", null, "current streak")))
    ),
    h("div", { className: "dashboard-grid" },
      h("div", { className: "main-column" },
        h("div", { className: "section-heading" }, h("div", null, h("p", { className: "eyebrow" }, "Today"), h("h2", null, "Your goals")), h("button", { className: "primary-action", onClick: () => setGoalModalOpen(true) }, h(Plus, { size: 18 }), "Add Goal")),
        h("div", { className: "goal-list" }, active.length ? active.map((goal) => h(GoalCard, { key: goal.id, goal, own: true, completeGoal, setEditingGoal, setGoalModalOpen, deleteGoal })) : h(EmptyState)),
        h("div", { className: "panel" }, h("h2", null, "Weekly completion"), h(WeeklyChart, { goals }))
      ),
      h("aside", { className: "side-column" },
        h("div", { className: "mini-stats" }, h(Stat, { icon: h(Check), label: "Done", value: completed.length }), h(Stat, { icon: h(Flame), label: "Streak", value: streak + "d" }), h(Stat, { icon: h(Share2), label: "Shared", value: goals.filter((goal) => goal.visibility !== "private").length })),
        h("div", { className: "completed-panel" }, h("h2", null, "Completed"), completed.length ? completed.map((goal) => h("article", { className: "completed-item", key: goal.id }, h("div", null, h("strong", null, goal.title), h("span", null, formatTime(goal.completed_at))))) : h("p", { className: "muted" }, "Completed goals will appear here.")),
        h("div", { className: "completed-panel" }, h("h2", null, "Friend activity"), feedGoals.slice(0, 4).map((goal) => h("article", { className: "activity-item", key: goal.id }, h("strong", null, goal.owner_name || "Friend"), h("span", null, goal.title))))
      )
    )
  );
}

function GoalCard({ goal, own, completeGoal, setEditingGoal, setGoalModalOpen, deleteGoal }) {
  return h("article", { className: "goal-card" },
    own && !goal.completed ? h("button", { className: "done-button", onClick: () => completeGoal(goal), "aria-label": "Mark " + goal.title + " as done" }, h(Check, { size: 20 })) : h("div", { className: "status-dot " + (goal.completed ? "done" : "open") }),
    h("div", null, h("h3", null, goal.title), goal.description ? h("p", null, goal.description) : null, h("span", null, goal.category + " • " + goal.visibility + " • " + (goal.completed ? "Completed " + formatTime(goal.completed_at) : "Open"))),
    own ? h("div", { className: "card-actions" }, h("button", { onClick: () => { setEditingGoal(goal); setGoalModalOpen(true); } }, "Edit"), h("button", { onClick: () => deleteGoal(goal) }, "Delete")) : null,
    h("div", { className: "check-burst", "aria-hidden": "true" }, h(Check, { size: 34 }))
  );
}

function Feed({ feedGoals, commentsByGoal, loadComments, addComment, deleteComment, toggleLike, userId }) {
  const [query, setQuery] = useState("");
  const filtered = feedGoals.filter((goal) => (goal.title + " " + goal.owner_name).toLowerCase().includes(query.toLowerCase()));
  const grouped = groupGoalsByOwner(filtered.map((goal) => ({ ...goal, profiles: { display_name: goal.owner_name } })));
  return h("section", { className: "feed-view wide" },
    h("div", { className: "section-heading" }, h("div", null, h("p", { className: "eyebrow" }, "Social"), h("h2", null, "Fitness feed")), h("label", { className: "search-box" }, h(Search, { size: 17 }), h("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Search public goals" }))),
    Object.entries(grouped).map(([owner, ownerGoals]) => h("div", { className: "owner-group", key: owner }, h("h3", null, owner + "'s Goals"), ownerGoals.map((goal) => h(FeedGoal, { key: goal.id, goal, comments: commentsByGoal[goal.id] || [], loadComments, addComment, deleteComment, toggleLike, userId }))))
  );
}

function FeedGoal({ goal, comments, loadComments, addComment, deleteComment, toggleLike, userId }) {
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  return h("article", { className: "post-card" },
    h("div", { className: "post-topline" }, h("div", { className: "avatar" }, (goal.owner_name || "F").slice(0, 1)), h("div", null, h("strong", null, goal.owner_name || "Fitness friend"), h("span", null, goal.visibility + " • " + (goal.completed ? "Completed " + formatTime(goal.completed_at) : "In progress")))),
    h("h3", null, goal.title), goal.description ? h("p", null, goal.description) : null,
    h("div", { className: "reaction-row" },
      h("button", { className: goal.viewer_liked ? "liked" : "", onClick: () => toggleLike(goal) }, h(Heart, { size: 17 }), goal.like_count || 0),
      h("button", { onClick: async () => { setOpen(!open); if (!open) await loadComments(goal.id); } }, h(MessageCircle, { size: 17 }), goal.comment_count || comments.length),
      h("span", { className: "pill" }, goal.category)
    ),
    open ? h("div", { className: "comments" },
      h("form", { onSubmit: async (event) => { event.preventDefault(); await addComment(goal, comment); setComment(""); } }, h("input", { value: comment, onChange: (event) => setComment(event.target.value), placeholder: "Write a comment" }), h("button", { type: "submit" }, h(Send, { size: 16 }))),
      comments.map((item) => h("div", { className: "comment", key: item.id }, h("div", null, h("strong", null, item.profiles?.display_name || "User"), h("span", null, item.comment)), (item.user_id === userId || goal.owner_id === userId) ? h("button", { onClick: () => deleteComment(item, goal) }, h(X, { size: 14 })) : null))
    ) : null
  );
}

function FriendsPage({ profiles, friends, userId, sendFriendRequest, updateFriendship, removeFriend }) {
  const [query, setQuery] = useState("");
  const relationshipUserIds = new Set(
    friends.map((item) => (item.requester_id === userId ? item.receiver_id : item.requester_id))
  );
  const filtered = profiles.filter(
    (profile) =>
      !relationshipUserIds.has(profile.id) &&
      profile.display_name?.toLowerCase().includes(query.toLowerCase())
  );
  const accepted = friends.filter((item) => item.status === "accepted");
  const incoming = friends.filter((item) => item.status === "pending" && item.receiver_id === userId);
  return h("section", { className: "page-grid" },
    h("div", { className: "panel" }, h("p", { className: "eyebrow" }, "Friends"), h("h2", null, "Find your people"), h("label", { className: "search-box" }, h(Search, { size: 17 }), h("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Search display names" })), filtered.length ? filtered.map((profile) => h("article", { className: "user-row", key: profile.id }, h("div", { className: "avatar" }, profile.display_name?.slice(0, 1)), h("div", null, h("strong", null, profile.display_name), h("span", null, profile.bio || "PulsePal member")), h("button", { onClick: () => sendFriendRequest(profile.id) }, h(UserPlus, { size: 16 }), "Add"))) : h("p", { className: "muted" }, "No new people match your search.")),
    h("div", { className: "panel" }, h("h2", null, "Requests"), incoming.length ? incoming.map((item) => h("article", { className: "user-row", key: item.id }, h("div", null, h("strong", null, item.requester?.display_name)), h("button", { onClick: () => updateFriendship(item, "accepted") }, "Accept"), h("button", { onClick: () => updateFriendship(item, "declined") }, "Decline"))) : h("p", { className: "muted" }, "No pending requests.")),
    h("div", { className: "panel" }, h("h2", null, "Friend list"), accepted.length ? accepted.map((item) => { const friend = item.requester_id === userId ? item.receiver : item.requester; return h("article", { className: "user-row", key: item.id }, h("div", { className: "avatar" }, friend?.display_name?.slice(0, 1)), h("strong", null, friend?.display_name), h("button", { onClick: () => removeFriend(item) }, "Remove")); }) : h("p", { className: "muted" }, "Accepted friends will show here."))
  );
}

function ProfilePage({ profile, goals, badges, friends, streak }) {
  const completed = goals.filter((goal) => goal.completed).length;
  const rate = goals.length ? Math.round((completed / goals.length) * 100) : 0;
  return h("section", { className: "profile-page" },
    h("div", { className: "profile-hero panel" }, h("div", { className: "avatar big" }, profile?.display_name?.slice(0, 1)), h("div", null, h("p", { className: "eyebrow" }, "Profile"), h("h2", null, profile?.display_name), h("p", null, profile?.bio || "No bio yet."))),
    h("div", { className: "mini-stats" }, h(Stat, { icon: h(Trophy), label: "Goals", value: goals.length }), h(Stat, { icon: h(Check), label: "Completed", value: completed }), h(Stat, { icon: h(Flame), label: "Streak", value: streak + "d" }), h(Stat, { icon: h(Users), label: "Friends", value: friends.filter((item) => item.status === "accepted").length }), h(Stat, { icon: h(BadgeCheck), label: "Rate", value: rate + "%" })),
    h("div", { className: "panel" }, h("h2", null, "Badges earned"), badges.length ? h("div", { className: "badge-grid" }, badges.map((item) => h("div", { className: "badge-card", key: item.id }, h(BadgeCheck), h("strong", null, item.badges?.name), h("span", null, item.badges?.description)))) : h("p", { className: "muted" }, "Complete goals to earn badges."))
  );
}

function NotificationsPage({ notifications, markNotificationRead }) {
  return h("section", { className: "panel" }, h("p", { className: "eyebrow" }, "Notifications"), h("h2", null, "Activity center"), notifications.length ? notifications.map((item) => h("article", { className: "notification " + (item.read ? "read" : "unread"), key: item.id }, h("div", null, h("strong", null, notificationText(item)), h("span", null, formatTime(item.created_at))), item.read ? null : h("button", { onClick: () => markNotificationRead(item) }, "Mark read"))) : h("p", { className: "muted" }, "No notifications yet."));
}

function notificationText(item) {
  const sender = item.sender?.display_name || "Someone";
  if (item.type === "like") return sender + " liked your goal";
  if (item.type === "comment") return sender + " commented on your goal";
  if (item.type === "friend_request") return sender + " sent a friend request";
  if (item.type === "friend_accepted") return sender + " accepted your request";
  if (item.type === "badge") return "You earned a new badge";
  return "New activity";
}

function GoalModal({ goal, onClose, onSave }) {
  const [form, setForm] = useState({ title: goal?.title || "", description: goal?.description || "", category: goal?.category || "Fitness", visibility: goal?.visibility || "public" });
  const [showSuggestions, setShowSuggestions] = useState(true);
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  return h("div", { className: "modal-backdrop" }, h("form", { className: "goal-modal", onSubmit: (event) => { event.preventDefault(); onSave(form); } },
    h("div", { className: "composer-title" }, h(Sparkles, { size: 19 }), h("span", null, goal ? "Edit Goal" : "Create Goal"), h("button", { type: "button", className: "icon-button", onClick: onClose, "aria-label": "Close" }, h(X, { size: 18 }))),
    h("label", null, "Goal title", h("input", { value: form.title, onFocus: () => setShowSuggestions(true), onChange: (event) => update("title", event.target.value), placeholder: "What are you doing today?", autoFocus: true })),
    showSuggestions ? h("div", { className: "suggestions" }, getGoalSuggestions().map((suggestion) => h("button", { type: "button", key: suggestion, onClick: () => { update("title", suggestion); setShowSuggestions(false); } }, suggestion))) : null,
    h("label", null, "Description", h("textarea", { value: form.description, onChange: (event) => update("description", event.target.value), rows: 3 })),
    h("div", { className: "field-row" }, h("label", null, "Category", h("select", { value: form.category, onChange: (event) => update("category", event.target.value) }, categories.map((item) => h("option", { key: item, value: item }, item)))), h("label", null, "Visibility", h("select", { value: form.visibility, onChange: (event) => update("visibility", event.target.value) }, visibilityOptions.map((item) => h("option", { key: item, value: item }, item))))),
    h("button", { className: "save-button", type: "submit" }, h(Check, { size: 18 }), "Save goal")
  ));
}

function WeeklyChart({ goals }) {
  const days = [...Array(7)].map((_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return date; });
  return h("div", { className: "weekly-chart" }, days.map((date) => { const count = goals.filter((goal) => goal.completed_at && dayKey(goal.completed_at) === dayKey(date)).length; return h("div", { className: "bar-wrap", key: dayKey(date) }, h("div", { className: "bar", style: { height: Math.max(10, count * 22) + "px" } }), h("span", null, new Intl.DateTimeFormat("en", { weekday: "short" }).format(date))); }));
}

function EmptyState() { return h("div", { className: "empty-state" }, h(Trophy, { size: 28 }), h("h3", null, "No active goals yet"), h("p", null, "Add one quick win and let the day start moving.")); }
function Stat({ icon, label, value }) { return h("div", { className: "stat" }, icon, h("span", null, label), h("strong", null, value)); }

createRoot(document.getElementById("root")).render(h(App));
