import { createElement, Fragment, type ElementType } from "react";

/**
 * Splits text into masked words so GSAP can slide each word up.
 * Works in server components — animation is wired up in ScrollEffects.
 */
const strip = (s: string) => s.replace(/[.,!?]/g, "");

export default function SplitText({
  text,
  as = "h2",
  className,
  hero = false,
  accentWords = [],
}: {
  text: string;
  as?: ElementType;
  className?: string;
  hero?: boolean;
  accentWords?: string[];
}) {
  const words = text.split(" ");
  return createElement(
    as,
    {
      className,
      "data-split": "",
      ...(hero ? { "data-hero": "" } : {}),
      "aria-label": text,
    },
    words.map((w, i) => (
      <Fragment key={i}>
        <span className="w" aria-hidden>
          <span className={accentWords.map(strip).includes(strip(w)) ? "text-accent-grad" : undefined}>
            {w}
          </span>
        </span>
        {i < words.length - 1 ? " " : null}
      </Fragment>
    ))
  );
}
