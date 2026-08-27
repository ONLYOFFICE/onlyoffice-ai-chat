import { motion } from "framer-motion";

/**
 * Three dots trailing a running block's label, each fading out and back on a
 * staggered loop — a lightweight "still working" cue. Decorative, so it's
 * hidden from assistive tech.
 *
 * Shared by the tool-call header and the reasoning ("Thinking") header so the
 * two read as the same kind of aside.
 */
export const LoadingDots = () => (
  <span aria-hidden="true" data-testid="loading-dots">
    {[0, 0.2, 0.4].map((delay) => (
      <motion.span
        key={delay}
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
      >
        .
      </motion.span>
    ))}
  </span>
);

export default LoadingDots;
