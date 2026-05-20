"use client";

// The team roster lives in the sidebar footer now (see Sidebar.tsx).
// This mount stays as a no-op so any lingering imports don't break the
// build, but the floating bottom-left dock is intentionally not rendered.
export default function TeamDockMount() {
  return null;
}
