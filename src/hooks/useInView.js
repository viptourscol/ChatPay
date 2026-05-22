import { useEffect, useRef, useState } from 'react';

/**
 * Hook ligero que usa IntersectionObserver para detectar
 * cuando un elemento entra al viewport.
 * @param {number} threshold - porcentaje visible para disparar (0-1)
 * @param {string} rootMargin - margen antes de disparar (e.g. "0px 0px -60px 0px")
 * @param {boolean} once - si true, deja de observar tras la primera aparición
 */
export function useInView(threshold = 0.15, rootMargin = '0px 0px -60px 0px', once = true) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, isVisible];
}
