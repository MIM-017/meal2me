"use client";

import { useEffect, useState } from "react";

type Slide = {
  title: string;
  text: string;
  match?: string[]; // text to look for on the page (links, buttons, inputs, title)
  selector?: string; // or a CSS selector, if text won't work
  custom?: "meal-name"; // special finders for things text matching can't reach
};

const SLIDES: Slide[] = [
  {
    title: "Welcome to Meal2Me!",
    text: "Take a quick tour of the site. Use the arrows below to move through each step.",
  },
  {
    title: "Back to the Home Page",
    text: "If you'd like to come back to the Home Page, just click on the title.",
    match: ["meal2me"],
  },
  {
    title: "Add meal",
    text: "Have a recipe to share? Use Add meal to put your own meal on the site.",
    match: ["add meal"],
  },
  {
    title: "Filters",
    text: "Use Filters to narrow down meals by what you're in the mood for.",
    match: ["filters"],
  },
  {
    title: "All Recipes",
    text: "Browse every recipe on the site in one place.",
    match: ["all recipes"],
  },
  {
    title: "Light / Dark theme",
    text: "Switch between the light and dark look of the site anytime.",
    match: ["light", "dark"],
  },
  {
    title: "Favorites",
    text: "Tap the star on any meal to save it, then find all your saved meals here.",
    match: ["favorites"],
  },
  {
    title: "Search",
    text: "Type a meal or cuisine into the search bar to find recipes quickly.",
    match: ["search"],
  },
  {
    title: "Surprise me!",
    text: "Not sure what to cook? Click Surprise me! for a random meal.",
    match: ["surprise me"],
  },
  {
    title: "Meal cards",
    text: "Click on a meal's name to open its full details. The star on the image adds it to your Favorites.",
    custom: "meal-name",
  },
];

const STORAGE_KEY = "meal2me-tutorial-seen";
const GOLD = "#d4a64a";

type Box = { top: number; left: number; width: number; height: number };
type Theme = { bg: string; fg: string };

function isTransparent(color: string) {
  return color === "transparent" || /,\s*0\)$/.test(color);
}

// Reads the page's real background and text color, so the popup matches light/dark mode
function readTheme(): Theme {
  const body = getComputedStyle(document.body);
  const html = getComputedStyle(document.documentElement);
  let bg = "#0f0d0b";
  if (!isTransparent(body.backgroundColor)) bg = body.backgroundColor;
  else if (!isTransparent(html.backgroundColor)) bg = html.backgroundColor;
  else if (!window.matchMedia("(prefers-color-scheme: dark)").matches)
    bg = "#ffffff";
  return { bg, fg: body.color || "#ffffff" };
}

// Finds the name text under the first meal image
function findMealName(): HTMLElement | null {
  const img = document.querySelector<HTMLElement>("main img");
  if (!img) return null;
  const imgRect = img.getBoundingClientRect();

  let container: HTMLElement | null = img.parentElement;
  for (let depth = 0; depth < 6 && container; depth++) {
    const leaves = Array.from(
      container.querySelectorAll<HTMLElement>("*")
    ).filter(
      (el) =>
        el.children.length === 0 &&
        (el.textContent || "").trim().length > 0 &&
        !el.closest("button") &&
        !el.closest("[data-tutorial]") &&
        el.getBoundingClientRect().top >= imgRect.bottom - 4
    );
    if (leaves.length > 0) return leaves[0];
    container = container.parentElement;
  }
  return null;
}

function findTarget(slide: Slide): HTMLElement | null {
  if (slide.custom === "meal-name") return findMealName();
  if (slide.selector) {
    return document.querySelector<HTMLElement>(slide.selector);
  }
  if (!slide.match) return null;

  const wanted = slide.match.map((m) => m.toLowerCase());
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("a, button, input, h1")
  );

  let best: HTMLElement | null = null;
  let bestLength = Infinity;

  for (const el of candidates) {
    if (el.closest("[data-tutorial]")) continue; // ignore the tutorial itself
    const raw =
      el instanceof HTMLInputElement ? el.placeholder : el.textContent;
    const label = (raw || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!label) continue;
    if (el.getBoundingClientRect().width === 0) continue;
    if (wanted.some((w) => label.includes(w)) && label.length < bestLength) {
      best = el;
      bestLength = label.length;
    }
  }
  return best;
}

// Items with their own border/background (pills, inputs, images) use their real edges.
// Plain text items use the text's actual bounds, so the outline is evenly centered.
function measure(el: HTMLElement): Box {
  const cs = getComputedStyle(el);
  const hasBorder =
    parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none";
  const hasBackground = !isTransparent(cs.backgroundColor);
  const isReplaced =
    el instanceof HTMLImageElement || el instanceof HTMLInputElement;

  let r = el.getBoundingClientRect();
  if (!isReplaced && !hasBorder && !hasBackground) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const textRect = range.getBoundingClientRect();
    if (textRect.width > 0 && textRect.height > 0) r = textRect;
  }
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function TutorialPopup() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [theme, setTheme] = useState<Theme>({ bg: "#0f0d0b", fg: "#ffffff" });

  // Show automatically the first time only
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  // Keep popup colors in sync with the page's light/dark mode
  useEffect(() => {
    function sync() {
      setTheme(readTheme());
      setTimeout(() => setTheme(readTheme()), 400); // in case the theme fades in
    }
    sync();
    const observer = new MutationObserver(sync);
    const opts = {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    };
    observer.observe(document.documentElement, opts);
    observer.observe(document.body, opts);
    return () => observer.disconnect();
  }, [open]);

  // Find and outline the element this slide is about
  useEffect(() => {
    if (!open) return;
    const slide = SLIDES[index];

    function update() {
      const el = findTarget(slide);
      setBox(el ? measure(el) : null);
    }

    findTarget(slide)?.scrollIntoView({ block: "center", behavior: "auto" });
    update();
    const timer = setTimeout(update, 300); // in case content loads late

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, index]);

  function close() {
    setOpen(false);
    setIndex(0);
    setBox(null);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const PAD = 10; // equal space around the highlighted item on every side

  // Put the popup on the opposite half of the screen from the highlighted item
  const targetIsInTopHalf =
    box !== null && box.top + box.height / 2 < window.innerHeight / 2;

  const arrowStyle = (disabled: boolean): React.CSSProperties => ({
    background: "none",
    border: "none",
    color: "inherit",
    fontSize: "34px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.25 : 1,
    padding: "0 10px",
  });

  return (
    <>
      {/* Small "?" button to reopen the tutorial */}
      {!open && (
        <button
          data-tutorial
          onClick={() => setOpen(true)}
          aria-label="Open tutorial"
          style={{
            position: "fixed",
            bottom: "10px",
            right: "10px",
            width: "30px",
            height: "30px",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            borderRadius: "50%",
            border: `1px solid ${GOLD}`,
            background: theme.bg,
            color: GOLD,
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
            zIndex: 50,
            opacity: 0.9,
          }}
        >
          ?
        </button>
      )}

      {open && (
        <div data-tutorial>
          {/* Blocks clicks on the page; dims it when nothing is highlighted */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: box ? "transparent" : "rgba(0,0,0,0.65)",
              zIndex: 100,
            }}
          />

          {/* Spotlight: dims everything except the highlighted element */}
          {box && (
            <div
              style={{
                position: "fixed",
                top: box.top - PAD,
                left: box.left - PAD,
                width: box.width + PAD * 2,
                height: box.height + PAD * 2,
                borderRadius: "14px",
                border: `3px solid ${GOLD}`,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
                boxSizing: "border-box",
                pointerEvents: "none",
                zIndex: 101,
                transition: "all 0.25s ease",
              }}
            />
          )}

          {/* The tutorial box */}
          <div
            style={{
              position: "fixed",
              left: "50%",
              transform: "translateX(-50%)",
              ...(box
                ? targetIsInTopHalf
                  ? { bottom: "32px" }
                  : { top: "32px" }
                : { top: "50%", transform: "translate(-50%, -50%)" }),
              width: "min(560px, 92vw)",
              background: theme.bg,
              color: theme.fg,
              border: `2px solid ${GOLD}`,
              borderRadius: "18px",
              padding: "32px 24px 20px",
              textAlign: "center",
              zIndex: 102,
            }}
          >
            <button
              onClick={close}
              aria-label="Close tutorial"
              style={{
                position: "absolute",
                top: "10px",
                right: "14px",
                background: "none",
                border: "none",
                color: "inherit",
                fontSize: "24px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            <h2
              style={{ fontSize: "26px", fontWeight: 700, marginBottom: "12px" }}
            >
              {slide.title}
            </h2>
            <p style={{ fontSize: "18px", lineHeight: 1.5, minHeight: "80px" }}>
              {slide.text}
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "16px",
              }}
            >
              <button
                onClick={() => setIndex(index - 1)}
                disabled={index === 0}
                aria-label="Previous"
                style={arrowStyle(index === 0)}
              >
                {"<"}
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to step ${i + 1}`}
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      border: `1px solid ${i === index ? GOLD : theme.fg}`,
                      padding: 0,
                      cursor: "pointer",
                      background: i === index ? GOLD : theme.fg,
                      opacity: i === index ? 1 : 0.4,
                    }}
                  />
                ))}
              </div>

              {isLast ? (
                <button
                  onClick={close}
                  style={{
                    background: "#cd7f4b",
                    border: "none",
                    borderRadius: "999px",
                    color: "white",
                    fontSize: "16px",
                    padding: "8px 18px",
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={() => setIndex(index + 1)}
                  aria-label="Next"
                  style={arrowStyle(false)}
                >
                  {">"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}